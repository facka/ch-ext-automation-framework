const ts = require('typescript')

/**
 * Strip TypeScript type annotations from source, producing plain JavaScript.
 * Uses ts.transpileModule with isolatedModules for fast per-file stripping.
 *
 * @param {string} source - The TypeScript source code
 * @param {string} filePath - The file path (used to determine JSX handling for .tsx)
 * @returns {{ code: string, lineMap: number[] } | { error: { message: string, line: number } }}
 */
function stripTypes(source, filePath) {
  try {
    const compilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      isolatedModules: true,
      sourceMap: true,
    }
    if (filePath.endsWith('.tsx')) {
      compilerOptions.jsx = ts.JsxEmit.Preserve
    }
    const result = ts.transpileModule(source, {
      compilerOptions,
      fileName: filePath,
    })

    // Check for diagnostics (transpilation errors)
    if (result.diagnostics && result.diagnostics.length > 0) {
      const diag = result.diagnostics[0]
      const line = diag.file
        ? ts.getLineAndCharacterOfPosition(diag.file, diag.start).line + 1
        : 1
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')
      return { error: { message, line } }
    }

    return { code: result.outputText, lineMap: getGeneratedLineMap(result.sourceMapText) }
  } catch (err) {
    return { error: { message: err.message, line: 1 } }
  }
}

// Decode the original source line for the first generated segment on each line.
// TypeScript emits source maps with VLQ-encoded mappings.
function getGeneratedLineMap(sourceMapText) {
  if (!sourceMapText) return [];
  var mappings = JSON.parse(sourceMapText).mappings.split(';');
  var originalLine = 0;
  var lineMap = [];

  for (var generatedLine = 0; generatedLine < mappings.length; generatedLine++) {
    var segments = mappings[generatedLine].split(',');
    for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      if (!segments[segmentIndex]) continue;
      var values = decodeVlqSegment(segments[segmentIndex]);
      if (values.length >= 3) {
        originalLine += values[2];
        if (segmentIndex === 0) {
          lineMap[generatedLine + 1] = originalLine + 1;
        }
      }
    }
  }
  return lineMap;
}

function decodeVlqSegment(segment) {
  var values = [];
  var value = 0;
  var shift = 0;
  for (var i = 0; i < segment.length; i++) {
    var digit = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(segment[i]);
    if (digit < 0) continue;
    value += (digit & 31) << shift;
    if ((digit & 32) === 0) {
      var negative = value & 1;
      values.push((value >> 1) * (negative ? -1 : 1));
      value = 0;
      shift = 0;
    } else {
      shift += 5;
    }
  }
  return values;
}

module.exports = { stripTypes }
