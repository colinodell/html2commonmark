interface WalkingStep {
    domNode: Node;
    isEntering: boolean;
}

interface NodeConversion {
    execute(container: commonmark.Node): commonmark.Node;
}

interface Html2AstOptions {
    rawHtmlElements?: Array<string>;
    ignoredHtmlElements?: Array<string>;
    interpretUnknownHtml?: boolean;
}

interface Ast2MarkdownOptions{
    preserveSoftbreaks?: boolean;
    preserveHardbreaks?: boolean;
}

interface HtmlParser {
    parse(html: string): HTMLElement;
}