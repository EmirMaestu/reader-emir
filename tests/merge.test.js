const test = require('node:test');
const assert = require('node:assert');
const { mergeLibrary } = require('../sync.js');

const book = (id, extra = {}) => Object.assign({ id, title: 'T' + id, author: 'A', added: 1, spineCount: 3 }, extra);
const lib = (...books) => ({ books: Object.fromEntries(books.map(b => [b.id, b])) });

test('libro solo remoto aparece en el resultado', () => {
  const r = mergeLibrary(lib(), lib(book('a')));
  assert.deepStrictEqual(r.lib.books.a, book('a'));
  assert.strictEqual(r.changedRemote, false);
});

test('libro solo local aparece y marca cambio remoto', () => {
  const r = mergeLibrary(lib(book('a')), lib());
  assert.ok(r.lib.books.a);
  assert.strictEqual(r.changedRemote, true);
});

test('progreso remoto más nuevo gana y se reporta', () => {
  const r = mergeLibrary(
    lib(book('a', { prog: { chapter: 0, frac: 0.1, at: 10 } })),
    lib(book('a', { prog: { chapter: 2, frac: 0.5, at: 20 } })));
  assert.deepStrictEqual(r.lib.books.a.prog, { chapter: 2, frac: 0.5, at: 20 });
  assert.deepStrictEqual(r.progFromRemote, ['a']);
  assert.strictEqual(r.changedRemote, false);
});

test('progreso local más nuevo gana y marca cambio remoto', () => {
  const r = mergeLibrary(
    lib(book('a', { prog: { chapter: 3, frac: 0, at: 30 } })),
    lib(book('a', { prog: { chapter: 2, frac: 0.5, at: 20 } })));
  assert.strictEqual(r.lib.books.a.prog.at, 30);
  assert.deepStrictEqual(r.progFromRemote, []);
  assert.strictEqual(r.changedRemote, true);
});

test('marcadores: gana el de marksAt más reciente', () => {
  const r = mergeLibrary(
    lib(book('a', { marks: [{ id: 1 }], marksAt: 5 })),
    lib(book('a', { marks: [{ id: 2 }], marksAt: 9 })));
  assert.deepStrictEqual(r.lib.books.a.marks, [{ id: 2 }]);
  assert.deepStrictEqual(r.marksFromRemote, ['a']);
});

test('tombstone remoto borra el libro local', () => {
  const r = mergeLibrary(lib(book('a', { prog: { chapter: 1, frac: 0, at: 50 } })), lib(book('a', { deleted: 40 })));
  assert.strictEqual(r.lib.books.a.deleted, 40);
  assert.deepStrictEqual(r.progFromRemote, []);
});

test('tombstone local se propaga al remoto', () => {
  const r = mergeLibrary(lib(book('a', { deleted: 40 })), lib(book('a')));
  assert.strictEqual(r.lib.books.a.deleted, 40);
  assert.strictEqual(r.changedRemote, true);
});

test('sin diferencias no hay cambio remoto', () => {
  const b = book('a', { prog: { chapter: 1, frac: 0.2, at: 7 }, marks: [], marksAt: 3 });
  const r = mergeLibrary(lib(b), lib(b));
  assert.strictEqual(r.changedRemote, false);
  assert.deepStrictEqual(r.progFromRemote, []);
});
