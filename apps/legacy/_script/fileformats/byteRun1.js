/*
 *  byteRun1.js
 *
 *  ByteRun1 / PackBits decoder helpers for Amiga ILBM BODY chunks.
 *  Supports standard ByteRun1 where 0x80 is a no-op, plus the legacy
 *  0x80 <byte> variant used by some encoders to express a 129-byte run.
 */

const ByteRun1 = (function () {
    const me = {};

    me.decodeLine = function (file, start, lineWidth, bodyEnd, repeat128) {
        const line = new Uint8Array(lineWidth);
        let readIndex = start;
        let writeIndex = 0;
        let valid = true;
        let extendedRuns = 0;

        function readByte() {
            if (readIndex >= bodyEnd) {
                valid = false;
                return 0;
            }
            return file.dataView.getUint8(readIndex++);
        }

        while (valid && writeIndex < lineWidth) {
            const control = readByte();
            if (!valid) break;

            if (control === 128) {
                if (!repeat128) continue;

                const value = readByte();
                if (!valid) break;
                if (writeIndex + 129 > lineWidth) {
                    valid = false;
                    break;
                }
                line.fill(value, writeIndex, writeIndex + 129);
                writeIndex += 129;
                extendedRuns++;
            } else if (control > 128) {
                const value = readByte();
                if (!valid) break;
                const count = 257 - control;
                if (writeIndex + count > lineWidth) {
                    valid = false;
                    break;
                }
                line.fill(value, writeIndex, writeIndex + count);
                writeIndex += count;
            } else {
                const count = control + 1;
                if (writeIndex + count > lineWidth) {
                    valid = false;
                    break;
                }
                for (let k = 0; k < count; k++) line[writeIndex++] = readByte();
            }
        }

        valid = valid && writeIndex === lineWidth;
        return { line, index: readIndex, valid, extendedRuns };
    };

    me.validateLine = function (file, start, lineWidth, bodyEnd, repeat128) {
        let readIndex = start;
        let count = 0;

        function readByte() {
            if (readIndex >= bodyEnd) return undefined;
            return file.dataView.getUint8(readIndex++);
        }

        while (count < lineWidth) {
            const control = readByte();
            if (control === undefined) return { valid: false, index: readIndex };

            if (control === 128) {
                if (!repeat128) continue;

                if (readByte() === undefined) return { valid: false, index: readIndex };
                count += 129;
            } else if (control > 128) {
                if (readByte() === undefined) return { valid: false, index: readIndex };
                count += 257 - control;
            } else {
                for (let k = 0; k <= control; k++) {
                    if (readByte() === undefined) return { valid: false, index: readIndex };
                }
                count += control + 1;
            }

            if (count > lineWidth) return { valid: false, index: readIndex };
        }

        return { valid: count === lineWidth, index: readIndex };
    };

    me.validateBody = function (file, lineWidth, bodyStart, bodyEnd, lineCount, repeat128) {
        let readIndex = bodyStart;

        for (let i = 0; i < lineCount; i++) {
            const result = me.validateLine(file, readIndex, lineWidth, bodyEnd, repeat128);
            if (!result.valid) return false;
            readIndex = result.index;
        }

        return readIndex === bodyEnd;
    };

    me.usesRepeat128 = function (file, lineWidth, bodyStart, bodyEnd, lineCount) {
        return !me.validateBody(file, lineWidth, bodyStart, bodyEnd, lineCount, false) &&
            me.validateBody(file, lineWidth, bodyStart, bodyEnd, lineCount, true);
    };

    me.readLine = function (file, lineWidth, bodyEnd, repeat128) {
        const result = me.decodeLine(file, file.index, lineWidth, bodyEnd, repeat128);
        file.goto(result.index);
        return result;
    };

    return me;
})();

export default ByteRun1;
