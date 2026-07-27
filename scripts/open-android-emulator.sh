#!/usr/bin/env bash
# Abre Expo Go en el emulador Android con 10.0.2.2
# (evita exp://192.168.x.x que deja Expo Go colgado).
#
# Uso:
#   1) Metro en otra terminal: npm run start:lan   (o npm run android)
#   2) Emulador Android encendido
#   3) npm run android:open
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"

if [[ ! -x "$ADB" ]]; then
  echo "No encontré adb en $ADB"
  echo "Instalá platform-tools o exportá ANDROID_HOME."
  exit 1
fi

wait_for_emulator() {
  local tries=40
  while (( tries > 0 )); do
    if "$ADB" devices | grep -qE 'emulator-[0-9]+\s+device$'; then
      local boot
      boot="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
      if [[ "$boot" == "1" ]]; then
        return 0
      fi
    fi
    sleep 2
    tries=$((tries - 1))
  done
  return 1
}

if ! "$ADB" devices | grep -qE 'emulator-[0-9]+\s+device$'; then
  if [[ ! -x "$EMU" ]]; then
    echo "No hay emulador corriendo y no encontré $EMU"
    exit 1
  fi
  AVD="${ANDROID_AVD:-}"
  if [[ -z "$AVD" ]]; then
    AVD="$("$EMU" -list-avds | head -1 | tr -d '\r')"
  fi
  if [[ -z "$AVD" ]]; then
    echo "No hay AVD. Creá uno en Android Studio (Device Manager)."
    exit 1
  fi
  echo "Arrancando emulador: $AVD …"
  "$EMU" -avd "$AVD" -netdelay none -netspeed full >/dev/null 2>&1 &
  if ! wait_for_emulator; then
    echo "El emulador no terminó de bootear a tiempo."
    exit 1
  fi
fi

if ! "$ADB" shell pm path host.exp.exponent >/dev/null 2>&1; then
  echo "Expo Go no está instalado en el emulador."
  echo "Abrí Play Store en el emulador e instalá «Expo Go» (SDK 54), o:"
  echo "  $ADB install ruta/a/Expo-Go.apk"
  exit 1
fi

# Metro debe escuchar en :8081 (cualquier modo). Reverse evita depender de LAN.
"$ADB" reverse tcp:8081 tcp:8081 >/dev/null
"$ADB" reverse tcp:8000 tcp:8000 >/dev/null

# Si Expo Go quedó colgado con exp://192.168.x.x, matarlo y reabrir bien.
"$ADB" shell am force-stop host.exp.exponent >/dev/null 2>&1 || true
sleep 0.6
"$ADB" shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" >/dev/null

echo "Expo Go → exp://127.0.0.1:8081 (vía adb reverse → Metro :8081)"
echo "Si sigue en blanco: en la Mac corré Metro con «npm run android» o «npx expo start --localhost»."
