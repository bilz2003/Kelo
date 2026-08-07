import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";

const MAX_CHARGER_PHOTOS = 2;

export function PhotosField({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const { tokens } = useTheme();

  const pickPhoto = async (index: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      aspect: [4, 3],
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const next = [...photos];
    next[index] = result.assets[0].uri;
    onChange(next.slice(0, MAX_CHARGER_PHOTOS));
  };

  const removePhoto = (index: number) => onChange(photos.filter((_, i) => i !== index));

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ marginBottom: 8, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>Photos</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
        {[0, 1].map((i) => {
          const photo = photos[i];
          return (
            <View
              key={i}
              style={{
                flex: 1, aspectRatio: 4 / 3, borderRadius: radii.lg, overflow: "hidden",
                backgroundColor: tokens.surface2,
                borderWidth: 1, borderColor: tokens.hair, borderStyle: photo ? "solid" : "dashed",
              }}
            >
              {photo ? (
                <>
                  <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
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
      <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
        Up to 2 photos of the space. Listings with photos help drivers picture where they're pulling up before they book.
      </Text>
    </View>
  );
}
