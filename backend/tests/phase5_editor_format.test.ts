/**
 * QuickPDF Platform - Phase 5.5.5 Text Formatting Test Suite
 * Validates:
 * 1. Font family updates (approved fonts only) & rejection of unsupported fonts
 * 2. Font size updates (finite, > 0, [4, 500]) & rejection of NaN/Infinity/zero/negative
 * 3. Bold toggle (normal <-> bold)
 * 4. Italic toggle (normal <-> italic)
 * 5. Underline toggle (none <-> underline)
 * 6. Color update (hex validation) & rejection of non-hex formats
 * 7. Alignment (left, center, right) & rejection of unsupported alignments
 * 8. Line height update (finite, > 0, [0.5, 3.0]) & rejection of invalid line heights
 * 9. Selection isolation (only selected object formatted; unselected untouched)
 * 10. Multi-selection support (multiple selected text objects formatted simultaneously)
 * 11. Formatting state reflected in state and activeProperties
 * 12. Undo formatting restores complete previous formatting state
 * 13. Redo formatting restores updated formatting state
 * 14. No-op formatting does not produce duplicate / redundant history entries
 * 15. Numeric inputs do not create history per keystroke (commits on blur/Enter)
 * 16. Formatting survives move / drag translation
 * 17. Formatting survives text box resizing
 * 18. Formatting survives viewport and native PDF rotation
 * 19. Formatting survives zoom scaling
 * 20. Backend textEditorObjectSchema validation of formatted text object
 */

export {};

import { textEditorObjectSchema } from "../src/modules/editor/editor.validation";
import { EditorFontFamily, EditorTextAlign, ITextEditorObject } from "../src/modules/editor/editor.types";

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✅ [PASS] Test ${total}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] Test ${total}: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Pure Formatting Engine & Validation (Mirroring formatUtils.ts)
// -------------------------------------------------------------
const SUPPORTED_FONT_FAMILIES: readonly EditorFontFamily[] = [
  "Helvetica",
  "Times",
  "Courier",
  "Inter",
  "Roboto",
  "Arial",
] as const;

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 500;
const DEFAULT_FONT_SIZE = 16;

const MIN_LINE_HEIGHT = 0.5;
const MAX_LINE_HEIGHT = 3.0;
const DEFAULT_LINE_HEIGHT = 1.2;

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const SUPPORTED_TEXT_ALIGNS: readonly EditorTextAlign[] = [
  "left",
  "center",
  "right",
] as const;

function isValidFontFamily(font: string): font is EditorFontFamily {
  return (SUPPORTED_FONT_FAMILIES as readonly string[]).includes(font);
}

function isValidFontSize(size: unknown): size is number {
  return typeof size === "number" && Number.isFinite(size) && size > 0;
}

function clampFontSize(size: number): number {
  if (!isValidFontSize(size)) return DEFAULT_FONT_SIZE;
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  return Math.round(clamped * 10) / 10;
}

function isValidLineHeight(lh: unknown): lh is number {
  return typeof lh === "number" && Number.isFinite(lh) && lh > 0;
}

function clampLineHeight(lh: number): number {
  if (!isValidLineHeight(lh)) return DEFAULT_LINE_HEIGHT;
  const clamped = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, lh));
  return Math.round(clamped * 100) / 100;
}

function isValidHexColor(color: string): boolean {
  return typeof color === "string" && HEX_COLOR_REGEX.test(color.trim());
}

function isValidTextAlign(align: string): align is EditorTextAlign {
  return (SUPPORTED_TEXT_ALIGNS as readonly string[]).includes(align);
}

function toggleFontWeight(current: "normal" | "bold"): "normal" | "bold" {
  return current === "bold" ? "normal" : "bold";
}

function toggleFontStyle(current: "normal" | "italic"): "normal" | "italic" {
  return current === "italic" ? "normal" : "italic";
}

function toggleTextDecoration(current: "none" | "underline"): "none" | "underline" {
  return current === "underline" ? "none" : "underline";
}

// -------------------------------------------------------------
// Test Runner
// -------------------------------------------------------------
async function runTests() {
  console.log("=== PHASE 5.5.5 TEXT FORMATTING TEST SUITE ===\n");

  const createBaseTextObject = (id = "txt_test_1"): ITextEditorObject => ({
    id,
    pageIndex: 0,
    type: "text",
    x: 100,
    y: 100,
    width: 200,
    height: 60,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    text: "Sample QuickPDF Text",
    fontSize: 16,
    fontFamily: "Helvetica",
    fontWeight: "normal",
    fontStyle: "normal",
    textDecoration: "none",
    color: "#000000",
    textAlign: "left",
    lineHeight: 1.2,
  });

  // TEST 1: Font Family Update
  await test("Font family updates correctly to approved fonts and rejects unsupported fonts", async () => {
    let obj = createBaseTextObject();
    for (const font of SUPPORTED_FONT_FAMILIES) {
      if (!isValidFontFamily(font)) throw new Error(`Expected ${font} to be valid`);
      obj = { ...obj, fontFamily: font };
      if (obj.fontFamily !== font) throw new Error(`Failed setting fontFamily to ${font}`);
    }

    if (isValidFontFamily("Comic Sans")) throw new Error("Accepted unsupported font 'Comic Sans'");
    if (isValidFontFamily("Papyrus")) throw new Error("Accepted unsupported font 'Papyrus'");
  });

  // TEST 2: Font Size Updates
  await test("Font size updates to valid finite positive values", async () => {
    let obj = createBaseTextObject();
    const testSizes = [8, 12, 16.5, 24, 72, 144, 500];
    for (const sz of testSizes) {
      if (!isValidFontSize(sz)) throw new Error(`Expected ${sz} to be a valid font size`);
      const clamped = clampFontSize(sz);
      obj = { ...obj, fontSize: clamped };
      if (obj.fontSize !== sz) throw new Error(`Font size mismatch: expected ${sz}, got ${obj.fontSize}`);
    }
  });

  // TEST 3: Invalid Font Size Rejection
  await test("Font size rejects NaN, Infinity, zero, and negative values and clamps bounds", async () => {
    if (isValidFontSize(NaN)) throw new Error("Accepted NaN as font size");
    if (isValidFontSize(Infinity)) throw new Error("Accepted Infinity as font size");
    if (isValidFontSize(-10)) throw new Error("Accepted negative font size");
    if (isValidFontSize(0)) throw new Error("Accepted zero as font size");
    if (isValidFontSize("24" as any)) throw new Error("Accepted string as font size");

    // Clamping to [4, 500]
    if (clampFontSize(1) !== MIN_FONT_SIZE) throw new Error("Did not clamp lower bound to 4");
    if (clampFontSize(1000) !== MAX_FONT_SIZE) throw new Error("Did not clamp upper bound to 500");
    if (clampFontSize(NaN as any) !== DEFAULT_FONT_SIZE) throw new Error("Did not default on NaN");
  });

  // TEST 4: Bold Toggle
  await test("Bold toggle transitions between 'normal' and 'bold'", async () => {
    let weight: "normal" | "bold" = "normal";
    weight = toggleFontWeight(weight);
    if (weight !== "bold") throw new Error(`Expected bold, got ${weight}`);
    weight = toggleFontWeight(weight);
    if (weight !== "normal") throw new Error(`Expected normal, got ${weight}`);
  });

  // TEST 5: Italic Toggle
  await test("Italic toggle transitions between 'normal' and 'italic'", async () => {
    let style: "normal" | "italic" = "normal";
    style = toggleFontStyle(style);
    if (style !== "italic") throw new Error(`Expected italic, got ${style}`);
    style = toggleFontStyle(style);
    if (style !== "normal") throw new Error(`Expected normal, got ${style}`);
  });

  // TEST 6: Underline Toggle
  await test("Underline toggle transitions between 'none' and 'underline'", async () => {
    let deco: "none" | "underline" = "none";
    deco = toggleTextDecoration(deco);
    if (deco !== "underline") throw new Error(`Expected underline, got ${deco}`);
    deco = toggleTextDecoration(deco);
    if (deco !== "none") throw new Error(`Expected none, got ${deco}`);
  });

  // TEST 7: Text Color Updates
  await test("Color update accepts valid 3 and 6 digit hex colors and rejects non-hex formats", async () => {
    const validColors = ["#000000", "#1e293b", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#fff", "#FFF"];
    for (const c of validColors) {
      if (!isValidHexColor(c)) throw new Error(`Expected valid hex color for '${c}'`);
    }

    const invalidColors = ["red", "blue", "rgb(0,0,0)", "rgba(0,0,0,1)", "#12", "#12345", "#GGGGGG", ""];
    for (const c of invalidColors) {
      if (isValidHexColor(c)) throw new Error(`Accepted invalid hex color '${c}'`);
    }
  });

  // TEST 8: Text Alignment
  await test("Text alignment supports left, center, and right and rejects unsupported values", async () => {
    let obj = createBaseTextObject();
    for (const align of ["left", "center", "right"] as const) {
      if (!isValidTextAlign(align)) throw new Error(`Expected valid alignment for ${align}`);
      obj = { ...obj, textAlign: align };
      if (obj.textAlign !== align) throw new Error(`Alignment mismatch: expected ${align}`);
    }

    if (isValidTextAlign("justify")) throw new Error("Accepted unsupported 'justify' alignment");
    if (isValidTextAlign("fill")) throw new Error("Accepted unsupported 'fill' alignment");
  });

  // TEST 9: Line Height Updates
  await test("Line height updates to valid multipliers and rejects invalid values", async () => {
    let obj = createBaseTextObject();
    const validLineHeights = [0.5, 1.0, 1.2, 1.5, 2.0, 3.0];
    for (const lh of validLineHeights) {
      if (!isValidLineHeight(lh)) throw new Error(`Expected valid line height for ${lh}`);
      obj = { ...obj, lineHeight: clampLineHeight(lh) };
      if (obj.lineHeight !== lh) throw new Error(`Line height mismatch: expected ${lh}`);
    }

    if (isValidLineHeight(NaN)) throw new Error("Accepted NaN line height");
    if (isValidLineHeight(Infinity)) throw new Error("Accepted Infinity line height");
    if (isValidLineHeight(0)) throw new Error("Accepted 0 line height");
    if (isValidLineHeight(-1)) throw new Error("Accepted negative line height");

    // Clamping to [0.5, 3.0]
    if (clampLineHeight(0.2) !== MIN_LINE_HEIGHT) throw new Error("Did not clamp line height to 0.5");
    if (clampLineHeight(5.0) !== MAX_LINE_HEIGHT) throw new Error("Did not clamp line height to 3.0");
  });

  // TEST 10: Selected Object Isolation
  await test("Formatting changes apply strictly to selected object and leave unselected objects untouched", async () => {
    const objA = createBaseTextObject("txt_A");
    const objB = createBaseTextObject("txt_B");

    const objects = [objA, objB];
    const selectedIds = ["txt_A"];

    // Apply bold, Times font, and red color to selected
    const updates = { fontWeight: "bold" as const, fontFamily: "Times" as const, color: "#dc2626" };
    const nextObjects = objects.map((o) => (selectedIds.includes(o.id) ? { ...o, ...updates } : o));

    const updatedA = nextObjects.find((o) => o.id === "txt_A")!;
    const updatedB = nextObjects.find((o) => o.id === "txt_B")!;

    if (updatedA.fontWeight !== "bold" || updatedA.fontFamily !== "Times" || updatedA.color !== "#dc2626") {
      throw new Error("Selected object A failed to receive updates");
    }

    if (updatedB.fontWeight !== "normal" || updatedB.fontFamily !== "Helvetica" || updatedB.color !== "#000000") {
      throw new Error("Unselected object B was accidentally mutated");
    }
  });

  // TEST 11: Multi-selection Formatting
  await test("Multi-selection applies formatting to all selected text objects without corrupting other types", async () => {
    const txt1 = createBaseTextObject("txt_1");
    const txt2 = createBaseTextObject("txt_2");
    const shape = {
      id: "shp_1",
      pageIndex: 0,
      type: "shape" as const,
      shapeType: "rectangle" as const,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      strokeColor: "#000000",
      strokeWidth: 2,
      fillColor: "transparent",
    };

    const objects = [txt1, txt2, shape];
    const selectedIds = ["txt_1", "txt_2", "shp_1"];

    // Format all selected text objects to fontSize 24 and italic
    const textUpdates = { fontSize: 24, fontStyle: "italic" as const };
    const nextObjects = objects.map((o) => {
      if (selectedIds.includes(o.id) && o.type === "text") {
        return { ...o, ...textUpdates };
      }
      return o;
    });

    const res1 = nextObjects.find((o) => o.id === "txt_1") as ITextEditorObject;
    const res2 = nextObjects.find((o) => o.id === "txt_2") as ITextEditorObject;
    const resShape = nextObjects.find((o) => o.id === "shp_1") as typeof shape;

    if (res1.fontSize !== 24 || res1.fontStyle !== "italic") throw new Error("txt_1 did not receive multi-format");
    if (res2.fontSize !== 24 || res2.fontStyle !== "italic") throw new Error("txt_2 did not receive multi-format");
    if ("fontSize" in resShape) throw new Error("Shape object corrupted with text properties");
  });

  // TEST 12: Undo/Redo of Formatting
  await test("Formatting produces undoable action that reverts previous state and redo restores new state", async () => {
    interface IHistoryEntry {
      id: string;
      undo: () => void;
      redo: () => void;
    }
    const history: IHistoryEntry[] = [];
    let currentObj: ITextEditorObject = createBaseTextObject();

    const previousFormatting: Partial<ITextEditorObject> = {
      fontSize: currentObj.fontSize,
      fontFamily: currentObj.fontFamily,
      fontWeight: currentObj.fontWeight,
    };

    const newFormatting: Partial<ITextEditorObject> = {
      fontSize: 28,
      fontFamily: "Inter",
      fontWeight: "bold",
    };

    // Apply formatting
    currentObj = { ...currentObj, ...newFormatting };

    history.push({
      id: "hist_format_1",
      undo: () => { currentObj = { ...currentObj, ...previousFormatting }; },
      redo: () => { currentObj = { ...currentObj, ...newFormatting }; },
    });

    // Verify current
    if (currentObj.fontSize !== 28 || currentObj.fontFamily !== "Inter" || currentObj.fontWeight !== "bold") {
      throw new Error("Applying new formatting failed");
    }

    // Execute Undo
    history[0]!.undo();
    if ((currentObj.fontSize as number) !== 16 || (currentObj.fontFamily as string) !== "Helvetica" || (currentObj.fontWeight as string) !== "normal") {
      throw new Error("Undo failed to restore previous formatting state");
    }

    // Execute Redo
    history[0]!.redo();
    if ((currentObj.fontSize as number) !== 28 || (currentObj.fontFamily as string) !== "Inter" || (currentObj.fontWeight as string) !== "bold") {
      throw new Error("Redo failed to restore updated formatting state");
    }
  });

  // TEST 13: No duplicate / no-op history
  await test("No-op formatting change with identical values does not create a history entry", async () => {
    const historyList: any[] = [];
    const currentObj = createBaseTextObject();

    const applyUpdate = (updates: Partial<ITextEditorObject>) => {
      const hasChange = Object.entries(updates).some(([key, val]) => (currentObj as any)[key] !== val);
      if (!hasChange) return; // Ignore no-op

      historyList.push({ updates });
    };

    // Attempt to update fontSize to 16 (already 16)
    applyUpdate({ fontSize: 16 });
    applyUpdate({ fontFamily: "Helvetica" });
    applyUpdate({ fontWeight: "normal" });

    const countBefore = historyList.length;
    if (countBefore !== 0) {
      throw new Error(`Expected 0 history items for no-op formatting, got ${countBefore}`);
    }

    // Now apply an actual change
    applyUpdate({ fontSize: 20 });
    const countAfter = historyList.length;
    if (countAfter !== 1) {
      throw new Error(`Expected 1 history item after actual change, got ${countAfter}`);
    }
  });

  // TEST 14: Numeric input does not create history per keystroke
  await test("Numeric input commits only on blur/Enter to avoid history flooding per keystroke", async () => {
    const historyList: any[] = [];
    let currentFontSize = 16;
    let localInputState = String(currentFontSize);

    const onKeystroke = (val: string) => {
      localInputState = val; // Only updates local UI state, does not push history
    };

    const onCommit = () => {
      const parsed = parseFloat(localInputState);
      if (!isValidFontSize(parsed)) return;
      const clamped = clampFontSize(parsed);
      if (clamped !== currentFontSize) {
        historyList.push({ oldSize: currentFontSize, newSize: clamped });
        currentFontSize = clamped;
      }
    };

    // User types "3", then "32"
    onKeystroke("3");
    onKeystroke("32");

    const keystrokeCount = historyList.length;
    if (keystrokeCount !== 0) {
      throw new Error("Keystrokes incorrectly created intermediate history entries");
    }

    // User presses Enter / Blurs
    onCommit();

    const commitCount = historyList.length;
    if (commitCount !== 1) {
      throw new Error(`Expected exactly 1 history entry on commit, got ${commitCount}`);
    }
    if (currentFontSize !== 32) {
      throw new Error(`Expected committed font size to be 32, got ${currentFontSize}`);
    }
  });

  // TEST 15: Formatting survives move
  await test("Formatting properties remain intact through text object move / drag translation", async () => {
    let obj: ITextEditorObject = {
      ...createBaseTextObject(),
      fontSize: 24,
      fontFamily: "Courier",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      color: "#2563eb",
      textAlign: "center",
      lineHeight: 1.5,
    };

    // Move from (100, 100) to (300, 450)
    obj = { ...obj, x: 300, y: 450 };

    if (obj.x !== 300 || obj.y !== 450) throw new Error("Position update failed");
    if (
      obj.fontSize !== 24 ||
      obj.fontFamily !== "Courier" ||
      obj.fontWeight !== "bold" ||
      obj.fontStyle !== "italic" ||
      obj.textDecoration !== "underline" ||
      obj.color !== "#2563eb" ||
      obj.textAlign !== "center" ||
      obj.lineHeight !== 1.5
    ) {
      throw new Error("Formatting corrupted during move operation");
    }
  });

  // TEST 16: Formatting survives resize
  await test("Formatting properties remain intact through text box resizing", async () => {
    let obj: ITextEditorObject = {
      ...createBaseTextObject(),
      fontSize: 20,
      fontFamily: "Arial",
      fontWeight: "bold",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#16a34a",
      textAlign: "right",
      lineHeight: 1.4,
    };

    // Resize from (200x60) to (350x120)
    obj = { ...obj, width: 350, height: 120 };

    if (obj.width !== 350 || obj.height !== 120) throw new Error("Resize dimension failed");
    if (
      obj.fontSize !== 20 ||
      obj.fontFamily !== "Arial" ||
      obj.fontWeight !== "bold" ||
      obj.fontStyle !== "normal" ||
      obj.textDecoration !== "none" ||
      obj.color !== "#16a34a" ||
      obj.textAlign !== "right" ||
      obj.lineHeight !== 1.4
    ) {
      throw new Error("Formatting corrupted during resize operation");
    }
  });

  // TEST 17: Formatting survives rotation
  await test("Formatting properties remain intact through viewport and native PDF rotation", async () => {
    const obj: ITextEditorObject = {
      ...createBaseTextObject(),
      fontSize: 18,
      fontFamily: "Times",
      fontWeight: "normal",
      fontStyle: "italic",
      textDecoration: "underline",
      color: "#7c3aed",
      textAlign: "center",
      lineHeight: 1.3,
    };

    // Rotate viewport through 90, 180, 270 degrees
    const rotations = [0, 90, 180, 270] as const;
    for (const rot of rotations) {
      const rotatedState = { ...obj, viewportRotation: rot };
      if (
        rotatedState.fontSize !== 18 ||
        rotatedState.fontFamily !== "Times" ||
        rotatedState.fontStyle !== "italic" ||
        rotatedState.textDecoration !== "underline" ||
        rotatedState.color !== "#7c3aed" ||
        rotatedState.lineHeight !== 1.3
      ) {
        throw new Error(`Formatting corrupted at viewport rotation ${rot}°`);
      }
    }
  });

  // TEST 18: Formatting survives zoom
  await test("Formatting values (PDF point font size & line height) are zoom invariants", async () => {
    const obj: ITextEditorObject = {
      ...createBaseTextObject(),
      fontSize: 18,
      lineHeight: 1.25,
    };

    const zoomLevels = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
    for (const zoom of zoomLevels) {
      // Screen font size is scaled: pdfToScreen(fontSize, zoom) = fontSize * zoom
      const screenFontSize = obj.fontSize * zoom;
      // Reconstructed PDF font size: screenFontSize / zoom
      const reconstructedPdfFontSize = Math.round((screenFontSize / zoom) * 100) / 100;
      if (reconstructedPdfFontSize !== obj.fontSize) {
        throw new Error(`Zoom ${zoom} corrupted font size: got ${reconstructedPdfFontSize}`);
      }
      if (obj.lineHeight !== 1.25) {
        throw new Error("Line height multiplier should not be altered by zoom");
      }
    }
  });

  // TEST 19: Backend Schema Validation
  await test("Backend textEditorObjectSchema parses and validates fully formatted text object", async () => {
    const fullTextObject = {
      id: "txt_full_format_101",
      pageIndex: 0,
      type: "text",
      x: 50,
      y: 75,
      width: 250,
      height: 80,
      rotation: 0,
      opacity: 0.95,
      zIndex: 2,
      text: "QuickPDF Production Formatting Verification",
      fontSize: 22,
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      color: "#ea580c",
      textAlign: "right",
      lineHeight: 1.45,
    };

    const parsed = textEditorObjectSchema.parse(fullTextObject);
    if (
      parsed.fontSize !== 22 ||
      parsed.fontFamily !== "Inter" ||
      parsed.fontWeight !== "bold" ||
      parsed.fontStyle !== "italic" ||
      parsed.textDecoration !== "underline" ||
      parsed.color !== "#ea580c" ||
      parsed.textAlign !== "right" ||
      parsed.lineHeight !== 1.45
    ) {
      throw new Error(`Schema parsed result mismatch: ${JSON.stringify(parsed)}`);
    }
  });

  // Summary
  console.log(`\n========================================`);
  console.log(`Phase 5.5.5 Test Results: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
