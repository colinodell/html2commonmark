import * as commonmark from 'commonmark';
import * as chai from 'chai';
import compareHtml from './compare-html';
import {HtmlParser} from '../../src/Types';
let expect = chai.expect;

export interface CompareOptions {
    ignoreListTightness?: boolean;
}

export default function assertEqualTrees(astExpected: commonmark.Node, astActual: commonmark.Node, htmlParser: HtmlParser, options: CompareOptions = {}, logInfo?: boolean) {
    astExpected = normalizeTree(astExpected);
    astActual = normalizeTree(astActual);
    let expectedWalker = astExpected.walker();
    let actualWalker = astActual.walker();
    let expectedValue: commonmark.NodeWalkingStep;

    if (logInfo) {
        console.log('expected: ', new commonmark.XmlRenderer().render(astExpected));
        console.log('actual: ', new commonmark.XmlRenderer().render(astActual));
    }
    while (expectedValue = expectedWalker.next()) {
        var actualValue = actualWalker.next();
        if (logInfo) {
            console.log(`verifying that: ${actualValue.node.type}/${actualValue.node.literal} is ${expectedValue.node.type}/${expectedValue.node.literal}`);
        }
        assertType(expectedValue.node, actualValue.node);
        assertLiteral(expectedValue.node, actualValue.node);
        assertInfo(expectedValue.node, actualValue.node);
        expect(actualValue).to.be.ok;
        ['level', 'title', 'destination'].forEach
            (prop => verifyNodePropertyEquality(expectedValue.node, actualValue.node, prop));

        if (expectedValue.node.type === 'List') {
            let listAttributes = ['listStart'];
            if (!options.ignoreListTightness) {
                listAttributes.push('listTight');
            }
            listAttributes.forEach(prop => verifyNodePropertyEquality(expectedValue.node, actualValue.node, prop));
        }
        expect(actualValue.entering).to.be.equal(expectedValue.entering);
    }

    function verifyNodePropertyEquality(expected: commonmark.Node, actual: commonmark.Node, propertyName) {
        expect(actual[propertyName], `comparing "${propertyName}" of ${expected.type}`).to.be.equal(expected[propertyName]);
    }

    function normalizeTree(root: commonmark.Node) {
        let walker = root.walker();
        let current: commonmark.NodeWalkingStep;
        while (current = walker.next()) {
            let currentNode = current.node;
            normalizeTextNodes(currentNode, walker);
            normalizeImageNodes(currentNode, walker);
            normalizeHtmlNodes(currentNode, walker);
        }
        return root;
    }

    function normalizeTextNodes(currentNode: commonmark.Node, walker: commonmark.NodeWalker) {
        if (currentNode.type === 'Text' && currentNode.next && currentNode.next.type === 'Text') {
            mergeNodes('Text', currentNode, currentNode.next, walker);
        }
        if (currentNode.type === 'Text' && !currentNode.literal) {
            removeCurrentNode(currentNode, walker);
        }
    }

    function isHtml(node: commonmark.Node) {
        return node && (node.type === 'Html' || node.type === 'HtmlBlock' || node.type === 'HtmlInline');
    }

    function normalizeHtmlNodes(currentNode: commonmark.Node, walker: commonmark.NodeWalker) {
        function isText(node: commonmark.Node) {
            return node && node.type === 'Text';
        }
        if (isHtml(currentNode) && (isHtml(currentNode.next) || isText(currentNode.next))) {
            mergeNodes(currentNode.next.type === 'HtmlBlock' ? 'HtmlBlock' : currentNode.type, currentNode, currentNode.next, walker);
        }
    }

    function mergeNodes(newNodeName: string, a: commonmark.Node, b: commonmark.Node, walker: commonmark.NodeWalker) {
        let newNode = new commonmark.Node(newNodeName);
        a.parent.appendChild(newNode);
        newNode.literal = a.literal + a.next.literal;
        a.insertBefore(newNode);
        a.next.unlink();
        a.unlink();
        walker.resumeAt(newNode);
    }

    function removeCurrentNode(nodeToRemove: commonmark.Node, walker: commonmark.NodeWalker) {
        let next = nodeToRemove.next, isEntering = true;
        if (!next) {
            next = nodeToRemove.parent;
            isEntering = false;
        }
        nodeToRemove.unlink();
        walker.resumeAt(next, isEntering);
    }

    function normalizeImageNodes(currentNode: commonmark.Node, walker: commonmark.NodeWalker) {
        if (currentNode.type === 'Image') {
            /* 
            "Though this spec is concerned with parsing, not rendering, it is recommended that in rendering to HTML, only the plain string content of the image description be used. Note that in the above example, the alt attribute’s value is foo bar, not foo [bar](/url) or foo <a href="/url">bar</a>. Only the plain string content is rendered, without formatting."
             - http://spec.commonmark.org/0.22/#images
             
             So normalize the content to be just one text node is fine
            */
            let text = '';
            let current: commonmark.NodeWalkingStep;
            while ((current = walker.next()).node !== currentNode) {
                if (current.entering && current.node.literal) {
                    text += current.node.literal;
                }
            }
            while (currentNode.firstChild) {
                currentNode.firstChild.unlink();
            }
            let textNode = new commonmark.Node('Text');
            textNode.literal = text;
            currentNode.appendChild(textNode);
        }
    }

    function assertLiteral(expecedValue: commonmark.Node, actualValue: commonmark.Node) {
        if (isHtml(expecedValue)) {
            // Compare the dom
            compareHtml(expecedValue.literal, actualValue.literal, htmlParser);
        } else {
            expect(actualValue.literal, `comparing literal of ${expecedValue.type}`).to.be.equal(expecedValue.literal);
        }
    }

    function assertType(expecedValue: commonmark.Node, actualValue: commonmark.Node) {
        if (isHtml(expecedValue)) {
            // Html blocks section Rule 7. The information about new lines between tags gets lost during parsing
            expect(isHtml(actualValue), `Comparing 'type' property was '${actualValue.type}' instead of 'HtmlInline' or 'HtmlBlock'`).
                to.be.equal(true);
        } else {
            expect(actualValue.type, 'Comparing type property').to.be.equal(expecedValue.type);
        }
    }

    function assertInfo(expectedValue: commonmark.Node, actualValue: commonmark.Node) {
        // Sometimes 'info' (from CodeBlock) is null vs empty string. Not sure how to detect the differences
        if (expectedValue.info === null || expectedValue.info === '') {
            expect(actualValue.info === null || actualValue.info === '', `Expecting 'info' of ${expectedValue.type} to be null or empty, was ${actualValue.info}`).to.be.equal(true);
        } else {
            // When the expected node info contains spaces, that info is lost after rendering
            let expectedInfo = expectedValue.info;
            if (expectedInfo.indexOf(' ') > -1 && actualValue.info && actualValue.info.indexOf(' ') === -1) {
                let indexOfSpace = expectedInfo.indexOf(' ');
                if (indexOfSpace >= 0) {
                    expectedInfo = expectedInfo.substr(0, indexOfSpace);
                }
            }
            expect(actualValue.info, `comparing info of ${expectedValue.type}`).to.be.equal(expectedInfo);
        }
    }
}