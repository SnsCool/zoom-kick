import { checkNgWords } from '@/lib/ng-word-checker';
import { NgWord } from '@/types';

const makeNgWord = (overrides: Partial<NgWord> & { word: string }): NgWord => ({
  id: '1',
  category: 'general',
  severity: 'medium',
  is_regex: false,
  ...overrides,
});

describe('checkNgWords', () => {
  describe('基本的な文字列マッチ', () => {
    it('NGワードを含むメッセージを検出する', () => {
      const ngWords = [makeNgWord({ word: '死ね', severity: 'high' })];
      const result = checkNgWords('死ね！ふざけんな', ngWords);
      expect(result.matched).toBe(true);
      expect(result.matchedWord).toBe('死ね');
      expect(result.severity).toBe('high');
    });

    it('NGワードを含まないメッセージはパスする', () => {
      const ngWords = [makeNgWord({ word: '死ね', severity: 'high' })];
      const result = checkNgWords('今日はいい天気ですね', ngWords);
      expect(result.matched).toBe(false);
      expect(result.matchedWord).toBeNull();
      expect(result.severity).toBeNull();
    });

    it('大文字小文字を区別しない (case insensitive)', () => {
      const ngWords = [makeNgWord({ word: 'spam' })];
      const result = checkNgWords('This is SPAM!', ngWords);
      expect(result.matched).toBe(true);
      expect(result.matchedWord).toBe('spam');
    });
  });

  describe('正規表現マッチ', () => {
    it('正規表現パターンでマッチする', () => {
      const ngWords = [makeNgWord({ word: 'https?://\\S+', is_regex: true, category: 'スパム' })];
      const result = checkNgWords('詳しくは https://spam.example.com まで', ngWords);
      expect(result.matched).toBe(true);
      expect(result.matchedWord).toBe('https?://\\S+');
    });

    it('無効な正規表現はスキップされる', () => {
      const ngWords = [makeNgWord({ word: '[invalid regex', is_regex: true })];
      const result = checkNgWords('テストメッセージ', ngWords);
      expect(result.matched).toBe(false);
    });
  });

  describe('優先度ソート', () => {
    it('high > medium > low の順で優先される', () => {
      const ngWords = [
        makeNgWord({ id: '1', word: 'テスト', severity: 'low' }),
        makeNgWord({ id: '2', word: 'テスト', severity: 'high' }),
        makeNgWord({ id: '3', word: 'テスト', severity: 'medium' }),
      ];
      const result = checkNgWords('これはテストです', ngWords);
      expect(result.matched).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('同じ優先度の場合は先にマッチしたものが返る', () => {
      const ngWords = [
        makeNgWord({ id: '1', word: '死ね', severity: 'high' }),
        makeNgWord({ id: '2', word: '殺す', severity: 'high' }),
      ];
      const result = checkNgWords('死ね殺す', ngWords);
      expect(result.matched).toBe(true);
      expect(result.matchedWord).toBe('死ね');
    });
  });

  describe('エッジケース', () => {
    it('空のメッセージはマッチしない', () => {
      const ngWords = [makeNgWord({ word: '死ね' })];
      const result = checkNgWords('', ngWords);
      expect(result.matched).toBe(false);
    });

    it('空のNGワードリストはマッチしない', () => {
      const result = checkNgWords('何でもいいメッセージ', []);
      expect(result.matched).toBe(false);
    });

    it('message が string でない場合は安全にfalseを返す', () => {
      const ngWords = [makeNgWord({ word: '死ね' })];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = checkNgWords(null as any, ngWords);
      expect(result.matched).toBe(false);
    });

    it('ngWords が配列でない場合は安全にfalseを返す', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = checkNgWords('テスト', null as any);
      expect(result.matched).toBe(false);
    });

    it('word が空のNGWordエントリはスキップされる', () => {
      const ngWords = [
        makeNgWord({ word: '' }),
        makeNgWord({ id: '2', word: 'テスト', severity: 'high' }),
      ];
      const result = checkNgWords('これはテストです', ngWords);
      expect(result.matched).toBe(true);
      expect(result.matchedWord).toBe('テスト');
    });

    it('severity が未定義の場合は "unknown" が返る', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ngWords = [{ id: '1', word: 'bad', category: 'test', is_regex: false } as any];
      const result = checkNgWords('this is bad', ngWords);
      expect(result.matched).toBe(true);
      expect(result.severity).toBe('unknown');
    });
  });
});
