import React, { useState, useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { API_BASE_URL, UPLOAD_ENDPOINT } from "./config";

// NOTE: This app intentionally mirrors the logic of the website's
// `FileUpload.jsx`, `chatStorage.js`, `MessageList.jsx`, and `FIRDisplay.jsx`,
// but adapted to React Native. The AI behavior and backend pipeline are
// identical because we call the same FastAPI `/api/upload` endpoint.

export default function App() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [chat, setChat] = useState(null); // Mirrors a single createNewChat result
  const [history, setHistory] = useState([]); // Optional history similar to web Sidebar

  const simulateProgress = () => {
    // Simple simulated progress similar to the web app's 0-90-100% behavior
    setProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      if (current >= 90) {
        current = 90;
        clearInterval(interval);
      }
      setProgress(current);
    }, 300);
    return interval;
  };

  const handlePickImage = useCallback(async () => {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permission to access media library is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const name = asset.fileName || "fir_image.jpg";
    const type = asset.type === "video" ? "video/*" : asset.mimeType || "image/jpeg";

    await uploadFile({ uri, name, type });
  }, []);

  const uploadFile = useCallback(
    async ({ uri, name, type }) => {
      setUploading(true);
      setError(null);
      setProgress(0);

      const progressInterval = simulateProgress();

      try {
        const formData = new FormData();

        // IMPORTANT: This mirrors the website's `formData.append("file", file)`
        // but uses React Native's `{ uri, name, type }` shape.
        formData.append("file", {
          uri,
          name,
          type,
        });

        const response = await fetch(UPLOAD_ENDPOINT, {
          method: "POST",
          headers: {
            // Let fetch set the correct multipart boundary automatically.
            // Do NOT manually set Content-Type with boundary.
          },
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (!response.ok) {
          let message = `Upload failed with status ${response.status}`;
          try {
            const errJson = await response.json();
            if (errJson && errJson.detail) {
              message = errJson.detail;
            }
          } catch {
            // ignore JSON parse errors and fall back to default message
          }
          throw new Error(message);
        }

        const data = await response.json();

        // Mirror website's createNewChat mapping as closely as possible.
        const mappedChat = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          filename: data.filename,
          fileSize: data.file_size,
          originalText: data.original_text || data.raw_urdu_text,
          correctedText: data.corrected_text || data.corrected_urdu_text,
          rawUrduText: data.raw_urdu_text,
          firStructuredData: data.fir_structured_data,
          extractionType: data.extraction_type || "text",
          correctionsApplied: data.corrections_applied,
          correctionStats: data.correction_stats || {},
        };

        setChat(mappedChat);

        // Maintain simple local history (most recent first), similar to web chatStorage.
        const nextHistory = [mappedChat, ...history].slice(0, 20);
        setHistory(nextHistory);
        try {
          await AsyncStorage.setItem(
            "specter_history",
            JSON.stringify(nextHistory)
          );
        } catch {
          // Non-fatal: history persistence failure should not break extraction.
        }
      } catch (e) {
        clearInterval(progressInterval);
        setError(e.message || "Failed to process file");
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    []
  );

  const renderFIRSection = (title, children) => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderDataField = (label, value, options = {}) => {
    if (!value) return null;
    return (
      <View style={[styles.fieldContainer, options.fullWidth && { width: "100%" }]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text
          style={styles.fieldValue}
          textBreakStrategy="simple"
        >
          {value}
        </Text>
      </View>
    );
  };

  const renderFIRDisplay = () => {
    if (!chat || !chat.firStructuredData) return null;
    const fir = chat.firStructuredData;

    return (
      <View style={styles.firContainer}>
        {/* Header Info */}
        {renderFIRSection("FIR Details", (
          <>
            {renderDataField("FIR Number", fir.fir_number)}
            {renderDataField("Police Station", fir.police_station)}
            {renderDataField("District", fir.district)}
          </>
        ))}

        {renderFIRSection("Registration Info", (
          <>
            {renderDataField("Date", fir.registration_date)}
            {renderDataField("Time", fir.registration_time)}
            {renderDataField(
              "Sections",
              Array.isArray(fir.sections_of_law)
                ? fir.sections_of_law.join(", ")
                : fir.sections_of_law
            )}
          </>
        ))}

        {fir.investigating_officer_details &&
          renderFIRSection("Investigating Officer", (
            <>
              {renderDataField(
                "Name",
                fir.investigating_officer_details.name
              )}
              {renderDataField(
                "Rank",
                fir.investigating_officer_details.rank
              )}
              {renderDataField(
                "Badge",
                fir.investigating_officer_details.badge_number
              )}
            </>
          ))}

        {fir.complainant_details &&
          renderFIRSection("Complainant Details", (
            <>
              {renderDataField("Name", fir.complainant_details.name)}
              {renderDataField(
                "Father/Husband",
                fir.complainant_details.father_or_husband_name
              )}
              {renderDataField(
                "Address",
                fir.complainant_details.address,
                { fullWidth: true }
              )}
              {renderDataField(
                "Contact",
                fir.complainant_details.contact_number
              )}
            </>
          ))}

        {Array.isArray(fir.accused_details) &&
          fir.accused_details.length > 0 &&
          renderFIRSection("Accused Details", (
            fir.accused_details.map((accused, idx) => (
              <View key={idx} style={styles.accusedCard}>
                {renderDataField("Name", accused.name)}
                {renderDataField(
                  "Father/Husband",
                  accused.father_or_husband_name
                )}
                {renderDataField(
                  "Address",
                  accused.address,
                  { fullWidth: true }
                )}
                {renderDataField(
                  "Description",
                  accused.description,
                  { fullWidth: true }
                )}
              </View>
            ))
          ))}

        {fir.occurrence_details &&
          renderFIRSection("Occurrence Details", (
            <>
              {renderDataField(
                "Date",
                fir.occurrence_details.date_of_occurrence
              )}
              {renderDataField(
                "Time",
                fir.occurrence_details.time_of_occurrence
              )}
              {renderDataField(
                "Place",
                fir.occurrence_details.place_of_occurrence,
                { fullWidth: true }
              )}
              {renderDataField(
                "Distance from Station",
                fir.occurrence_details.distance_from_police_station,
                { fullWidth: true }
              )}
            </>
          ))}

        {fir.brief_facts_of_case &&
          renderFIRSection("Brief Facts of Case", (
            <View style={styles.rawTextBox}>
              <Text style={styles.urduParagraph}>{fir.brief_facts_of_case}</Text>
            </View>
          ))}

        {Array.isArray(fir.witnesses) &&
          fir.witnesses.length > 0 &&
          renderFIRSection("Witnesses", (
            fir.witnesses.map((witness, idx) => (
              <View key={idx} style={styles.witnessCard}>
                {renderDataField("Name", witness.name)}
                {renderDataField(
                  "Father/Husband",
                  witness.father_or_husband_name
                )}
                {renderDataField(
                  "Address",
                  witness.address,
                  { fullWidth: true }
                )}
              </View>
            ))
          ))}
      </View>
    );
  };

  const textForStats = (chat && (chat.correctedText || chat.rawUrduText)) || "";
  const charCount = textForStats.length;
  const wordCount =
    textForStats
      .split(/\s+/)
      .filter((w) => w.length > 0).length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SpecterApp - FIR Extraction</Text>
        <Text style={styles.headerSubtitle}>
          Mirrors Urdu FIR extraction behavior of the web app (FastAPI /api/upload)
        </Text>
      </View>

      {history.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.historyBar}
          contentContainerStyle={styles.historyContent}
        >
          {history.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.historyChip,
                chat && chat.id === item.id && styles.historyChipActive,
              ]}
              onPress={() => {
                setChat(item);
                setError(null);
              }}
            >
              <Text
                style={[
                  styles.historyChipText,
                  chat && chat.id === item.id && styles.historyChipTextActive,
                ]}
                numberOfLines={1}
              >
                {item.filename || "Untitled"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.uploadContainer}>
        <TouchableOpacity
          style={[
            styles.uploadButton,
            uploading && { opacity: 0.6 },
          ]}
          onPress={handlePickImage}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Select FIR Image</Text>
          )}
        </TouchableOpacity>
        {uploading || progress > 0 ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        ) : null}
        <Text style={styles.apiInfo}>
          Backend: {API_BASE_URL}/api/upload
        </Text>
      </View>

      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsContent}
      >
        {chat ? (
          <View style={styles.resultsCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>File:</Text>
              <Text style={styles.metaValue}>{chat.filename}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Characters:</Text>
              <Text style={styles.metaValue}>{charCount}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Words:</Text>
              <Text style={styles.metaValue}>{wordCount}</Text>
            </View>

            {renderFIRDisplay()}

            {/* Raw or corrected Urdu text (full) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Complete Urdu Text</Text>
              <View style={styles.rawTextBox}>
                <Text style={styles.urduParagraph}>
                  {chat.correctedText || chat.rawUrduText}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            Select an FIR image to extract structured Urdu text.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#a1a1aa",
    fontSize: 12,
    marginTop: 4,
  },
  historyBar: {
    maxHeight: 40,
    paddingHorizontal: 8,
  },
  historyContent: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  historyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#27272a",
    marginRight: 8,
    backgroundColor: "#020617",
  },
  historyChipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#111827",
  },
  historyChipText: {
    color: "#9ca3af",
    fontSize: 11,
  },
  historyChipTextActive: {
    color: "#e5e7eb",
  },
  errorBanner: {
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#7f1d1d",
  },
  errorText: {
    color: "#fee2e2",
    fontSize: 13,
  },
  uploadContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  uploadButton: {
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  progressContainer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#27272a",
    overflow: "hidden",
    marginRight: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#22c55e",
  },
  progressText: {
    color: "#e5e5e5",
    fontSize: 12,
  },
  apiInfo: {
    marginTop: 6,
    fontSize: 11,
    color: "#71717a",
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  resultsCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  metaValue: {
    color: "#e5e7eb",
    fontSize: 12,
    marginLeft: 8,
    flexShrink: 1,
    textAlign: "right",
  },
  firContainer: {
    marginTop: 12,
  },
  sectionCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#312e81",
  },
  sectionTitle: {
    color: "#e0e7ff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  fieldContainer: {
    marginBottom: 4,
  },
  fieldLabel: {
    color: "#9ca3af",
    fontSize: 11,
  },
  fieldValue: {
    color: "#f9fafb",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rawTextBox: {
    marginTop: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  urduParagraph: {
    color: "#f9fafb",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
    writingDirection: "rtl",
  },
  accusedCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  witnessCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1d4ed8",
  },
});
