import { Alert, InteractionManager, Linking, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export type UploadFileAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

export type UploadSource = "camera" | "gallery" | "files";

function extensionFromMime(mime: string | undefined): string {
  if (!mime) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("pdf")) return "pdf";
  return "jpg";
}

function fileFromImageAsset(
  asset: ImagePicker.ImagePickerAsset,
  prefix: string,
): UploadFileAsset {
  const mimeType = asset.mimeType ?? "image/jpeg";
  const ext = extensionFromMime(mimeType);
  const name = asset.fileName?.trim() || `${prefix}-${Date.now()}.${ext}`;
  return {
    uri: asset.uri,
    name,
    mimeType,
  };
}

/** Esperar a que el Modal del sheet se desmonte antes de abrir cámara/galería. */
export function waitForModalDismiss(ms = 400): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

function showPermissionAlert(kind: "cámara" | "galería") {
  Alert.alert(
    `Permiso de ${kind}`,
    `Necesitamos acceso a la ${kind} para cargar el documento. Activalo en Ajustes.`,
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Abrir Ajustes",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ],
  );
}

async function ensureCameraPermission(): Promise<boolean> {
  // Cámara
  let camera = await ImagePicker.getCameraPermissionsAsync();
  if (!camera.granted) {
    if (!camera.canAskAgain) {
      showPermissionAlert("cámara");
      return false;
    }
    camera = await ImagePicker.requestCameraPermissionsAsync();
    if (!camera.granted) {
      showPermissionAlert("cámara");
      return false;
    }
  }

  // En Android (y iOS antiguo) también hace falta la librería para guardar/tomar foto
  if (Platform.OS === "android") {
    let library = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!library.granted) {
      if (!library.canAskAgain) {
        showPermissionAlert("galería");
        return false;
      }
      library = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!library.granted) {
        showPermissionAlert("galería");
        return false;
      }
    }
  }

  return true;
}

async function ensureGalleryPermission(): Promise<boolean> {
  let current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    showPermissionAlert("galería");
    return false;
  }
  current = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  showPermissionAlert("galería");
  return false;
}

export async function pickFromCamera(docType: string): Promise<UploadFileAsset | null> {
  try {
    if (!(await ensureCameraPermission())) return null;

    // Tras el diálogo de permisos / cierre de modal, Android necesita un tic
    await waitForModalDismiss(Platform.OS === "android" ? 350 : 250);

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      exif: false,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return fileFromImageAsset(result.assets[0], `camera-${docType}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo abrir la cámara";
    Alert.alert("Cámara", message);
    return null;
  }
}

export async function pickFromGallery(docType: string): Promise<UploadFileAsset | null> {
  try {
    if (!(await ensureGalleryPermission())) return null;
    await waitForModalDismiss(250);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
      exif: false,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return fileFromImageAsset(result.assets[0], `gallery-${docType}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo abrir la galería";
    Alert.alert("Galería", message);
    return null;
  }
}

export async function pickFromFiles(): Promise<UploadFileAsset | null> {
  try {
    await waitForModalDismiss(200);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["image/*", "application/pdf"],
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name ?? `document-${Date.now()}`,
      mimeType: asset.mimeType ?? "application/octet-stream",
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo abrir el selector de archivos";
    Alert.alert("Archivos", message);
    return null;
  }
}

export async function pickUploadFile(
  docType: string,
  source: UploadSource,
): Promise<UploadFileAsset | null> {
  if (source === "camera") return pickFromCamera(docType);
  if (source === "gallery") return pickFromGallery(docType);
  return pickFromFiles();
}
