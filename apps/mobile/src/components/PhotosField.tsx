import React, { useState } from "react";
import { View, Text, Pressable, Image, Linking, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, X, TriangleAlert } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { uploadPhoto, PhotoDraft } from "@/api/photos";

const MAX_CHARGER_PHOTOS = 2;

export function PhotosField({ photos, onChange }: { photos: PhotoDraft[]; onChange: (photos: PhotoDraft[]) => void }) {
  const { tokens } = useTheme();
  // null = no permission problem to report. Distinguishing the two denial
  // states matters: once canAskAgain is false, calling
  // requestMediaLibraryPermissionsAsync() again just silently re-denies —
  // the only way forward is the OS Settings screen, so the message and
  // action shown have to differ from a simple "tap try again" case.
  const [permissionIssue, setPermissionIssue] = useState<"retry" | "settings" | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickPhoto = async (index: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionIssue(permission.canAskAgain ? "retry" : "settings");
      return;
    }
    setPermissionIssue(null);
    setUploadError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      aspect: [4, 3],
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingIndex(index);
    try {
      const asset = result.assets[0];
      const draft = await uploadPhoto(asset.uri, asset.mimeType ?? "image/jpeg");
      const next = [...photos];
      next[index] = draft;
      onChange(next.slice(0, MAX_CHARGER_PHOTOS));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload that photo — try again.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const removePhoto = (index: number) => onChange(photos.filter((_, i) => i !== index));

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ marginBottom: 8, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>Photos</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
        {[0, 1].map((i) => {
          const photo = photos[i];
          const uploading = uploadingIndex === i;
          return (
            <View
              key={i}
              style={{
                flex: 1, aspectRatio: 4 / 3, borderRadius: radii.lg, overflow: "hidden",
                backgroundColor: tokens.surface2,
                borderWidth: 1, borderColor: tokens.hair, borderStyle: photo ? "solid" : "dashed",
              }}
            >
              {uploading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={tokens.cyan} />
                </View>
              ) : photo ? (
                <>
                  <Image source={{ uri: photo.previewUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  <Pressable
                    onPress={() => removePhoto(i)}
                    style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(18,22,28,0.72)", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={12} color="#EDEEF0" />
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => pickPhoto(i)} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Camera size={18} color={tokens.textSoft} />
                  <Text style={{ fontSize: 11, color: tokens.textSoft }}>Add photo</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {uploadError && (
        <View style={{ flexDirection: "row", gap: 8, backgroundColor: "rgba(232,132,107,0.1)", borderWidth: 1, borderColor: "rgba(232,132,107,0.35)", borderRadius: radii.md, padding: 12, marginBottom: 8 }}>
          <TriangleAlert size={14} color={tokens.danger} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, color: tokens.text, lineHeight: 17 }}>{uploadError}</Text>
        </View>
      )}

      {permissionIssue && (
        <View style={{ flexDirection: "row", gap: 8, backgroundColor: "rgba(232,132,107,0.1)", borderWidth: 1, borderColor: "rgba(232,132,107,0.35)", borderRadius: radii.md, padding: 12, marginBottom: 8 }}>
          <TriangleAlert size={14} color={tokens.danger} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tokens.text, lineHeight: 17 }}>
              {permissionIssue === "settings"
                ? "Photo access is turned off for Kelo. Enable it in Settings to add photos to this listing."
                : "Kelo needs permission to access your photos before you can add one here."}
            </Text>
            {permissionIssue === "settings" && (
              <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: tokens.cyan }}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
        Up to 2 photos of the space. Listings with photos help drivers picture where they're pulling up before they book.
      </Text>
    </View>
  );
}
