import Converter from '../../src/Converter';
import * as commonmark from 'commonmark';
import * as chai from 'chai';
import {HtmlParser} from '../../src/Types';
let expect = chai.expect;

export default (description: string, htmlParser: HtmlParser) => {

    let write = (root: commonmark.Node) => console.log(new commonmark.XmlRenderer().render(root));
    let forAllNodes = (root: commonmark.Node, action: (node: commonmark.Node) => void) => {
        let walker = root.walker();
        let walkStep: commonmark.NodeWalkingStep;
        while (walkStep = walker.next()) {
            if (walkStep.entering) {
                action(walkStep.node);
            }
        }
    };

    describe(`${description}: Converter`, () => {
        describe('using rawHtmlElements: \'p\', \'some-stuff\', interpretUnknownHtml: false', () => {

            let sut: Converter;

            before(() => {
                sut = new Converter(htmlParser, { rawHtmlElements: ['p', 'some-stuff'], interpretUnknownHtml: false, ignoredHtmlElements: [] });
            });

            let pAndSomeStuff = '<p><some-stuff></some-stuff><p>';
            it(`should interpret '${pAndSomeStuff}' as raw html elements`, () => {
                let actualAst = sut.convert('<p><some-stuff></some-stuff><p>');
                expect(actualAst.type).to.be.equal('Document');
                let count = 0;
                for (let current = actualAst.firstChild; current; current = current.next) {
                    count++;
                    expect(current.type).to.be.equal('HtmlBlock');
                }
                expect(count).to.be.eq(4);
            });

            let unknownHtmlElements = '<random-element>some<str> html </str>and whitespaces</random-element>'
            it(`should interpret '${unknownHtmlElements}' as text`, () => {
                let actualAst = sut.convert(unknownHtmlElements);
                expect(actualAst.type).to.be.eq('Document');
                let count = 0;
                let literal = '';
                for (let current = actualAst.firstChild; current; current = current.next) {
                    count++;
                    expect(current.type).to.be.eq('Text');
                    literal += current.literal;
                }
                expect(count).to.be.eq(3);
                expect(literal).to.be.eq('somehtmland whitespaces');
            });
        });

        describe('using ignoredHtmlElements: \'p\', \'some-stuff\', interpretUnknownHtml: true', () => {

            let sut: Converter;

            before(() => {
                sut = new Converter(htmlParser, { ignoredHtmlElements: ['p', 'some-stuff'], interpretUnknownHtml: true, rawHtmlElements: [] });
            });

            let pAndSomeStuff = '<p><some-stuff></some-stuff><p>';
            it(`should interpret '${pAndSomeStuff}' as empty`, () => {
                let actualAst = sut.convert(pAndSomeStuff);
                expect(actualAst.type).to.be.eq('Document');
                expect(actualAst.firstChild).to.not.be.ok;
            });

            let randomElementPStrong = '<random-element><p><strong>strong</strong></p></random-element>';
            it(`should interpret ${randomElementPStrong} as <random-element><strong>strong</strong></random-element>`, () => {
                let actualAst = sut.convert(randomElementPStrong);
                expect(actualAst.type).to.be.eq('Document');
                expect(actualAst.firstChild.type).to.be.eq('HtmlBlock');
                expect(actualAst.firstChild.literal).to.be.eq('<random-element>');
                expect(actualAst.firstChild.next.type).to.be.eq('Strong');
                expect(actualAst.firstChild.next.firstChild.type).to.be.eq('Text');
                expect(actualAst.firstChild.next.firstChild.literal).to.be.eq('strong');
                expect(actualAst.firstChild.next.next.type).to.be.eq('HtmlBlock');
                expect(actualAst.firstChild.next.next.literal).to.be.eq('</random-element>');
            });
        });

        describe('when testing issues', () => {

            let sut: Converter;
            before(() => {
                sut = new Converter(htmlParser);
            });

            let htmlListWithInlineContent = `<ul><li><em>3</em> <code>nodes</code></li></ul>`;
            it(`should not create multiple paragraphs for ${htmlListWithInlineContent} (https://github.com/nicojs/html2commonmark/issues/1)`, () => {
                let actualAst = sut.convert(htmlListWithInlineContent);
                let numberOfParagraphs = 0;
                forAllNodes(actualAst, node => {
                    if (node.type === 'Paragraph') {
                        numberOfParagraphs++;
                    }
                });
                expect(numberOfParagraphs, `Created ${numberOfParagraphs} paragraphs for inline content where 1 paragraph was expected. Abstract syntax tree is: ${new commonmark.XmlRenderer().render(actualAst)}`).to.be.eq(1);
            });

        });
    });
};