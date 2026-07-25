import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";

export interface ResolvedAddress {
  street: string;
  city: string;
  state: string;
  zip_code: string;
}

interface Suggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  /** Algunos proveedores resuelven la dirección en la misma llamada; si no, vienen vacíos. */
  street: string;
  city: string;
  state: string;
  zip_code: string;
}

interface AutocompleteResponse {
  suggestions: Suggestion[];
}

interface AddressAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelect: (address: ResolvedAddress) => void;
  placeholder?: string;
  error?: string;
}

function newSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AddressAutocomplete({
  label,
  value,
  onChangeText,
  onSelect,
  placeholder,
  error,
}: AddressAutocompleteProps) {
  const { token } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const sessionToken = useRef<string>(newSessionToken());
  const justSelected = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          session_token: sessionToken.current,
        });
        const data = await api.get<AutocompleteResponse>(
          `/portal/addresses/autocomplete?${params.toString()}`,
          token,
        );
        if (cancelled) return;
        setSuggestions(data.suggestions);
        setOpen(data.suggestions.length > 0);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value, token]);

  async function handleSelect(suggestion: Suggestion) {
    justSelected.current = true;
    setOpen(false);
    setSuggestions([]);
    if (suggestion.street && suggestion.city && suggestion.state && suggestion.zip_code) {
      onSelect({
        street: suggestion.street,
        city: suggestion.city,
        state: suggestion.state,
        zip_code: suggestion.zip_code,
      });
      return;
    }
    if (!token) {
      onChangeText(suggestion.main_text || suggestion.description);
      return;
    }
    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        session_token: sessionToken.current,
      });
      const details = await api.get<ResolvedAddress>(
        `/portal/addresses/details?${params.toString()}`,
        token,
      );
      onSelect({
        street: details.street || suggestion.main_text || suggestion.description,
        city: details.city,
        state: details.state,
        zip_code: details.zip_code,
      });
    } catch {
      onChangeText(suggestion.main_text || suggestion.description);
    } finally {
      sessionToken.current = newSessionToken();
    }
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.brownMuted}
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="words"
        autoComplete="off"
        textContentType="none"
      />
      {open && suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((s) => (
            <Pressable
              key={s.place_id}
              onPress={() => handleSelect(s)}
              style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}
            >
              <Text style={styles.optionMain}>{s.main_text}</Text>
              {s.secondary_text ? (
                <Text style={styles.optionSecondary}>{s.secondary_text}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  inputError: {
    borderColor: colors.danger,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  optionPressed: {
    backgroundColor: colors.creamSoft,
  },
  optionMain: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: "500",
  },
  optionSecondary: {
    fontSize: 12,
    color: colors.soft,
    marginTop: 2,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
});
