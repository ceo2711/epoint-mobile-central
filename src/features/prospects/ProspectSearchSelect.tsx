import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/contexts/LanguageContext";
import type { ProspectSearchResponse } from "@/features/prospects/searchProspects";
import { colors, radii } from "@/theme/tokens";
import type { Prospect } from "@/types/api";

const MIN_NAME_SEARCH_LENGTH = 3;
const MIN_EMAIL_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 350;

function minSearchLength(query: string): number {
  return query.includes("@") ? MIN_EMAIL_SEARCH_LENGTH : MIN_NAME_SEARCH_LENGTH;
}

export type ProspectSearchHit = Pick<
  Prospect,
  "id" | "full_name" | "email" | "status" | "first_name" | "last_name" | "phone"
>;

type ProspectSearchSelectProps = {
  label?: string;
  searchPlaceholder?: string;
  prospect?: ProspectSearchHit | null;
  onSearch: (query: string) => Promise<ProspectSearchResponse>;
  onChange: (prospect: Prospect | null) => void;
  disabled?: boolean;
  externalSearch?: string;
  linkedHint?: string;
  changeLabel?: string;
  clearLabel?: string;
};

export function ProspectSearchSelect({
  label,
  searchPlaceholder,
  prospect,
  onSearch,
  onChange,
  disabled = false,
  externalSearch,
  linkedHint,
  changeLabel,
  clearLabel,
}: ProspectSearchSelectProps) {
  const { t } = useTranslation();
  const searchRequestRef = useRef(0);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickingAnother, setPickingAnother] = useState(false);

  const manualSearch = search.trim();
  const activeQuery =
    pickingAnother || manualSearch.length > 0
      ? manualSearch
      : (externalSearch?.trim() ?? "");

  useEffect(() => {
    if (prospect) setPickingAnother(false);
  }, [prospect]);

  useEffect(() => {
    const query = activeQuery;
    if (disabled || (prospect && !pickingAnother) || query.length < minSearchLength(query)) {
      setHasSearched(false);
      setOptions([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++searchRequestRef.current;
      setLoading(true);

      void onSearch(query)
        .then((results) => {
          if (requestId !== searchRequestRef.current) return;
          setOptions(results.items);
          setTotal(results.total);
          setHasSearched(true);
        })
        .catch(() => {
          if (requestId !== searchRequestRef.current) return;
          setOptions([]);
          setTotal(0);
          setHasSearched(true);
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [activeQuery, onSearch, disabled, prospect, pickingAnother]);

  function handlePick(match: Prospect) {
    setSearch("");
    setOptions([]);
    setTotal(0);
    setHasSearched(false);
    setPickingAnother(false);
    onChange(match);
  }

  function handleClear() {
    setSearch("");
    setOptions([]);
    setTotal(0);
    setHasSearched(false);
    setPickingAnother(false);
    onChange(null);
  }

  function handleChangeProspect() {
    setPickingAnother(true);
    setSearch("");
    setOptions([]);
    setTotal(0);
    setHasSearched(false);
  }

  if (prospect && !pickingAnother) {
    return (
      <View style={styles.block}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.linkedCard}>
          <View style={styles.linkedMain}>
            <View style={styles.linkedNameRow}>
              <Text style={styles.linkedName}>{prospect.full_name}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>
                  {t(`prospects.statusLabels.${prospect.status}`)}
                </Text>
              </View>
            </View>
            <Text style={styles.linkedEmail}>{prospect.email}</Text>
            <Text style={styles.linkedHint}>
              {linkedHint ?? t("contracts.prospectLinkedHint")}
            </Text>
          </View>
          {!disabled ? (
            <View style={styles.linkedActions}>
              <Pressable onPress={handleChangeProspect} hitSlop={8}>
                <Text style={styles.changeLink}>
                  {changeLabel ?? t("contracts.changeProspect")}
                </Text>
              </Pressable>
              <Pressable onPress={handleClear} hitSlop={8}>
                <Text style={styles.clearLink}>
                  {clearLabel ?? t("contracts.clearProspect")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const showDropdown =
    activeQuery.length >= minSearchLength(activeQuery) && (loading || hasSearched);

  return (
    <View style={styles.block}>
      <Input
        label={label}
        value={search}
        onChangeText={setSearch}
        placeholder={searchPlaceholder}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {activeQuery.length < minSearchLength(activeQuery) ? (
        <Text style={styles.hint}>{t("prospects.linkPickerPrompt")}</Text>
      ) : null}

      {showDropdown ? (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.dropdownState}>
              <ActivityIndicator color={colors.brand} size="small" />
              <Text style={styles.hint}>{t("common.loading")}</Text>
            </View>
          ) : options.length === 0 ? (
            <Text style={styles.dropdownEmpty}>{t("prospects.linkPickerEmpty")}</Text>
          ) : (
            <>
              <ScrollView
                style={styles.optionsList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {options.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handlePick(item)}
                    style={styles.option}
                  >
                    <View style={styles.linkedNameRow}>
                      <Text style={styles.optionName}>{item.full_name}</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>
                          {t(`prospects.statusLabels.${item.status}`)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.optionEmail}>{item.email}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {total > options.length ? (
                <Text style={styles.moreHint}>
                  {t("prospects.searchMoreHint", {
                    shown: options.length,
                    total,
                  })}
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.soft,
  },
  linkedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.brandMuted,
    backgroundColor: colors.brandLight,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkedMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  linkedNameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  linkedName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  linkedEmail: {
    fontSize: 13,
    color: colors.soft,
  },
  linkedHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand,
  },
  linkedActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  changeLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  clearLink: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
  },
  statusPill: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brown,
  },
  dropdown: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
  },
  dropdownState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownEmpty: {
    fontSize: 12,
    color: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionsList: {
    maxHeight: 220,
  },
  option: {
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  optionEmail: {
    fontSize: 13,
    color: colors.soft,
  },
  moreHint: {
    fontSize: 12,
    color: colors.soft,
    backgroundColor: colors.creamSoft,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
