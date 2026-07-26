import { Linking, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";

import { colors } from "@/theme/tokens";

interface MarkdownBodyProps {
  content: string;
}

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  heading1: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brown,
    marginTop: 8,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brown,
    marginTop: 8,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brown,
    marginTop: 6,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  strong: {
    fontWeight: "700",
    color: colors.brown,
  },
  em: {
    fontStyle: "italic",
  },
  link: {
    color: colors.brand,
    textDecorationLine: "underline",
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
  list_item: {
    marginBottom: 4,
  },
  bullet_list_icon: {
    color: colors.brand,
    fontSize: 16,
    lineHeight: 22,
  },
  ordered_list_icon: {
    color: colors.brown,
    fontSize: 14,
    lineHeight: 22,
  },
  code_inline: {
    backgroundColor: colors.creamWarm,
    color: colors.brown,
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: colors.creamWarm,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  code_block: {
    backgroundColor: colors.creamWarm,
    color: colors.ink,
    fontSize: 13,
  },
  blockquote: {
    backgroundColor: colors.creamSoft,
    borderColor: colors.brand,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  hr: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 12,
  },
});

export function MarkdownBody({ content }: MarkdownBodyProps) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  return (
    <Markdown
      style={markdownStyles}
      mergeStyle
      onLinkPress={(url) => {
        void Linking.openURL(url);
        return false;
      }}
    >
      {trimmed}
    </Markdown>
  );
}
