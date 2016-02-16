import tests from './read-commonmark-tests';
import MarkdownRenderer from '../../src/MarkdownRenderer';
import * as commonmark from 'commonmark';
import compareMD from './compare-md';
import {HtmlParser} from '../../src/Types';

export default (description: string, htmlParser: HtmlParser) => {
    let sut = new MarkdownRenderer();
    let commonmarkParser = new commonmark.Parser();
    let xmlWriter = new commonmark.XmlRenderer();
    
    // Too bad, still needed to exclude these examples
    let excluded = [
        '1.      indented code\n\n   paragraph\n\n       more code\n',
        '1.     indented code\n\n   paragraph\n\n       more code\n',
        '&nbsp; &amp; &copy; &AElig; &Dcaron;\n&frac34; &HilbertSpace; &DifferentialD;\n&ClockwiseContourIntegral; &ngE;\n'
    ];
    
    var oneLine = (line: string) => line.replace(/(\r\n|\n|\r)/gm, "\\n");
    var oneLineXml = (xml: string) => oneLine(xml.substr(85).replace(/>\n\s+</gm, '> <').replace(/>\n/gm, '>'));

    describe(description, () => {
        tests
            .filter(t => excluded.indexOf(t.markdown) < 0)
            .forEach(test => {
                let ast = commonmarkParser.parse(test.markdown);
                let astXml = oneLineXml(xmlWriter.render(ast));

                it(`test #${test.example}, section ${test.section}:\n(ast:) ${astXml}\n(md:)  ${oneLine(test.markdown)}`, () => {
                    let actualMarkdown = sut.render(ast);
                    let actualAst = commonmarkParser.parse(actualMarkdown);
                    compareMD(ast, actualAst, htmlParser, false);
                });
            });
    });
};