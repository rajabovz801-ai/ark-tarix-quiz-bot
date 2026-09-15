export type OptionKey = "A" | "B" | "C" | "D";

export type ParsedQuestion = {
  text: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
};

export type ParsedQuiz = {
  title: string;
  questions: ParsedQuestion[];
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel" | string;
  title?: string;
};
