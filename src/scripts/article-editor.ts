type Block =
  | { type: 'paragraph' | 'heading'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'list'; items: string[] }
  | { type: 'image'; mediaId: string; caption?: string };

const form = document.getElementById('article-form') as HTMLFormElement | null;
const store = document.getElementById('body-json') as HTMLTextAreaElement | null;
const container = document.querySelector<HTMLElement>('[data-blocks]');
const dialog = document.querySelector<HTMLDialogElement>('[data-media-dialog]');

if (form && store && container) {
  const s = JSON.parse(form.dataset.editorStrings ?? '{}') as Record<string, string>;
  const editable = !(document.getElementById('title') as HTMLInputElement | null)?.disabled;
  let blocks: Block[] = [];
  try {
    blocks = JSON.parse(store.value) as Block[];
  } catch {
    blocks = [];
  }
  let dirty = false;
  let pickTarget: { kind: 'cover' } | { kind: 'block'; index: number } | null = null;

  const mediaSrc = (id: string) =>
    document.querySelector<HTMLElement>(`[data-media-id="${CSS.escape(id)}"]`)?.dataset.src ?? '';

  const sync = () => {
    store.value = JSON.stringify(blocks);
  };
  const markDirty = () => {
    dirty = true;
    sync();
  };

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}): HTMLElementTagNameMap[K] =>
    Object.assign(document.createElement(tag), props);

  const button = (label: string, onClick: () => void) => {
    const b = el('button', { type: 'button', className: 'btn btn--small', textContent: label });
    b.addEventListener('click', onClick);
    return b;
  };

  const textInput = (value: string, multiline: boolean, onInput: (v: string) => void, label: string) => {
    const input: HTMLTextAreaElement | HTMLInputElement = multiline ? el('textarea', { value }) : el('input', { value });
    input.setAttribute('aria-label', label);
    input.dir = 'auto';
    input.disabled = !editable;
    input.addEventListener('input', () => {
      onInput(input.value);
      markDirty();
    });
    return input;
  };

  const render = () => {
    container.replaceChildren();
    blocks.forEach((block, index) => {
      const wrap = el('div', { className: 'block' });
      const head = el('div', { className: 'block__head' });
      head.append(el('span', { className: 'block__type', textContent: s[block.type] ?? block.type }));
      if (editable) {
        head.append(
          button(s.up!, () => move(index, -1)),
          button(s.down!, () => move(index, 1)),
          button(s.remove!, () => {
            blocks.splice(index, 1);
            markDirty();
            render();
          }),
        );
      }
      wrap.append(head);

      if (block.type === 'paragraph' || block.type === 'heading') {
        wrap.append(textInput(block.text, block.type === 'paragraph', (v) => (block.text = v), s[block.type]!));
      } else if (block.type === 'quote') {
        wrap.append(
          textInput(block.text, true, (v) => (block.text = v), s.quote!),
          textInput(block.cite ?? '', false, (v) => (block.cite = v || undefined), s.source!),
        );
      } else if (block.type === 'list') {
        const input = textInput(block.items.join('\n'), true, (v) => (block.items = v.split('\n').map((x) => x.trim()).filter(Boolean)), s.list!);
        input.setAttribute('placeholder', s.listHint!);
        wrap.append(input);
      } else if (block.type === 'image') {
        const src = block.mediaId ? mediaSrc(block.mediaId) : '';
        if (src) wrap.append(el('img', { src, alt: '' }));
        if (editable) wrap.append(button(s.choose!, () => openPicker({ kind: 'block', index })));
        wrap.append(textInput(block.caption ?? '', false, (v) => (block.caption = v || undefined), s.caption!));
      }
      container.append(wrap);
    });
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
    markDirty();
    render();
  };

  const add = (type: Block['type']) => {
    const block: Block =
      type === 'list' ? { type, items: [] } : type === 'image' ? { type, mediaId: '' } : type === 'quote' ? { type, text: '' } : { type, text: '' };
    blocks.push(block);
    markDirty();
    render();
    if (type === 'image') openPicker({ kind: 'block', index: blocks.length - 1 });
    else (container.lastElementChild?.querySelector('textarea, input') as HTMLElement | null)?.focus();
  };

  const openPicker = (target: NonNullable<typeof pickTarget>) => {
    pickTarget = target;
    dialog?.showModal();
  };

  const applyPick = (id: string, src: string) => {
    if (!pickTarget) return;
    if (pickTarget.kind === 'cover') {
      (document.getElementById('cover_media_id') as HTMLInputElement).value = id;
      const preview = document.querySelector('[data-cover-preview]');
      preview?.replaceChildren(el('img', { src, alt: '' }));
      dirty = true;
    } else {
      const block = blocks[pickTarget.index];
      if (block?.type === 'image') block.mediaId = id;
      markDirty();
      render();
    }
    dialog?.close();
    pickTarget = null;
  };

  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) =>
    b.addEventListener('click', () => add(b.dataset.add as Block['type'])),
  );
  document.querySelector('[data-pick-cover]')?.addEventListener('click', () => openPicker({ kind: 'cover' }));
  document.querySelector('[data-clear-cover]')?.addEventListener('click', () => {
    (document.getElementById('cover_media_id') as HTMLInputElement).value = '';
    document.querySelector('[data-cover-preview]')?.replaceChildren();
    dirty = true;
  });
  document.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog?.close());

  const grid = document.querySelector<HTMLElement>('[data-media-grid]');
  grid?.addEventListener('click', (event) => {
    const tile = (event.target as HTMLElement).closest<HTMLElement>('[data-media-id]');
    if (tile) applyPick(tile.dataset.mediaId!, tile.dataset.src ?? '');
  });

  const upload = document.querySelector<HTMLInputElement>('[data-upload-input]');
  const uploadStatus = document.querySelector<HTMLElement>('[data-upload-status]');
  upload?.addEventListener('change', async () => {
    const file = upload.files?.[0];
    if (!file) return;
    if (uploadStatus) uploadStatus.textContent = s.uploading!;
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch('/admin/media/upload/', { method: 'POST', body, credentials: 'same-origin' });
      const result = (await res.json()) as { id?: string; src?: string; width?: number; height?: number };
      if (!res.ok || !result.id) throw new Error('upload failed');
      const tile = el('button', { type: 'button', className: 'media-tile' });
      tile.dataset.mediaId = result.id;
      tile.dataset.src = result.src ?? '';
      tile.append(el('img', { src: result.src ?? '', alt: '' }));
      grid?.prepend(tile);
      if (uploadStatus) uploadStatus.textContent = '';
      applyPick(result.id, result.src ?? '');
    } catch {
      if (uploadStatus) uploadStatus.textContent = s.badImage!;
    } finally {
      upload.value = '';
    }
  });

  form.addEventListener('input', () => (dirty = true));
  form.addEventListener('submit', () => {
    // Drop empty blocks so a stray "add" does not block saving.
    blocks = blocks.filter((b) =>
      b.type === 'list' ? b.items.length > 0 : b.type === 'image' ? b.mediaId !== '' : b.text.trim() !== '',
    );
    sync();
    dirty = false;
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault();
  });

  sync();
  render();
}
