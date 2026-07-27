import { StyleSheet, Text } from "react-native";

import { parseCommentBody } from "@/features/boards/utils/commentMentions";
import { colors, radii } from "@/theme/tokens";

interface CommentBodyProps {
  body: string;
}

export function CommentBody({ body }: CommentBodyProps) {
  const parts = parseCommentBody(body);

  return (
    <Text style={styles.body}>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <Text key={`m-${index}`} style={styles.mention}>
            @{part.name}
          </Text>
        ) : (
          <Text key={`t-${index}`}>{part.value}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  mention: {
    color: colors.brand,
    fontWeight: "700",
    backgroundColor: colors.brandLight,
    borderRadius: radii.control,
    overflow: "hidden",
  },
});
