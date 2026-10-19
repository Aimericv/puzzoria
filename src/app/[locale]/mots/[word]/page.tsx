import { WordArticlePage, wordArticleMetadata, type WordArticleProps } from "@/components/word-article-page";
export const dynamic = "force-dynamic";
export const generateMetadata = (props: WordArticleProps) => wordArticleMetadata(props, "fr");
export default function Page(props: WordArticleProps) {return <WordArticlePage {...props} expected="fr" />;}
