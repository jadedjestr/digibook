import { act, render } from '@testing-library/react';
import { describe, test, expect } from 'vitest';

import { useSwipeToReveal } from '../useSwipeToReveal';

const RAIL_WIDTH = 72;

// A real render is required, not renderHook: the hook attaches its
// touchmove listener to the DOM node in bind.ref via an effect that runs
// right after commit, exactly like production usage (`<div ref={bind.ref}>`)
// - renderHook alone never mounts anything, so bind.ref.current would stay
// null and that effect would find nothing to attach to.
function TestRow({ options, onState }) {
  const state = useSwipeToReveal(options);
  onState(state);
  return (
    <div
      data-testid='row'
      ref={state.bind.ref}
      onTouchStart={state.bind.onTouchStart}
      onTouchEnd={state.bind.onTouchEnd}
    />
  );
}

const setup = (options = { railWidth: RAIL_WIDTH }) => {
  let state;
  const { container, rerender: baseRerender } = render(
    <TestRow options={options} onState={s => (state = s)} />,
  );

  // Scoped to this render's own container - render() from
  // @testing-library/react mounts into the shared document, so a
  // document-wide getByTestId would collide once a second row is rendered
  // in the same test (see the two-row tests below).
  const node = container.querySelector('[data-testid="row"]');
  const rerender = () =>
    act(() => {
      baseRerender(<TestRow options={options} onState={s => (state = s)} />);
    });
  return { node, getState: () => state, rerender };
};

const touchStart = (node, x, y) => {
  act(() => {
    node.dispatchEvent(
      new TouchEvent('touchstart', {
        touches: [{ clientX: x, clientY: y }],
        bubbles: true,
      }),
    );
  });
};

const touchMove = (node, x, y) => {
  act(() => {
    node.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: x, clientY: y }],
        bubbles: true,
        cancelable: true,
      }),
    );
  });
};

const touchEnd = node => {
  act(() => {
    node.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  });
};

describe('useSwipeToReveal', () => {
  test('movement under the direction-lock threshold changes nothing', () => {
    const { node, getState } = setup();

    touchStart(node, 100, 100);
    touchMove(node, 104, 100); // 4px, below the 8px lock

    expect(getState().offset).toBe(0);
    expect(getState().openDirection).toBeNull();
  });

  test('vertical-dominant movement never opens the row', () => {
    const { node, getState } = setup();

    touchStart(node, 100, 100);
    touchMove(node, 105, 130); // dy (30) dominates dx (5)
    touchEnd(node);

    expect(getState().offset).toBe(0);
    expect(getState().openDirection).toBeNull();
  });

  test('a horizontal drag is clamped to the rail width', () => {
    const { node, getState } = setup();

    touchStart(node, 200, 100);
    touchMove(node, 50, 100); // dragged 150px left, past railWidth (72)

    expect(getState().offset).toBe(-RAIL_WIDTH);
  });

  test('crossing the open threshold before release snaps fully open', () => {
    const { node, getState } = setup();

    touchStart(node, 200, 100);
    touchMove(node, 170, 100); // 30px left, > 40% of 72 (28.8)
    touchEnd(node);

    expect(getState().offset).toBe(-RAIL_WIDTH);
    expect(getState().openDirection).toBe('right');
  });

  test('staying under the open threshold snaps back closed', () => {
    const { node, getState } = setup();

    touchStart(node, 200, 100);
    touchMove(node, 190, 100); // 10px left, < 40% of 72 (28.8)
    touchEnd(node);

    expect(getState().offset).toBe(0);
    expect(getState().openDirection).toBeNull();
  });

  test('a positive drag (swipe right) opens the left rail', () => {
    const { node, getState } = setup();

    touchStart(node, 100, 100);
    touchMove(node, 140, 100); // 40px right, > 28.8 threshold
    touchEnd(node);

    expect(getState().offset).toBe(RAIL_WIDTH);
    expect(getState().openDirection).toBe('left');
  });

  test('opening one row closes another already-open row', () => {
    const rowA = setup();
    const rowB = setup();

    touchStart(rowA.node, 200, 100);
    touchMove(rowA.node, 170, 100);
    touchEnd(rowA.node);
    expect(rowA.getState().offset).toBe(-RAIL_WIDTH);

    // Starting a drag on row B - even one that doesn't itself cross the
    // open threshold - claims "active" the moment it locks horizontal,
    // which must close row A immediately.
    touchStart(rowB.node, 200, 100);
    touchMove(rowB.node, 190, 100); // only 10px, won't open on its own
    rowA.rerender();

    expect(rowA.getState().offset).toBe(0);
  });

  test('close() resets the offset and releases the shared active slot', () => {
    const rowA = setup();
    const rowB = setup();

    touchStart(rowA.node, 200, 100);
    touchMove(rowA.node, 170, 100);
    touchEnd(rowA.node);
    expect(rowA.getState().offset).toBe(-RAIL_WIDTH);

    act(() => {
      rowA.getState().close();
    });
    expect(rowA.getState().offset).toBe(0);

    // Releasing the slot must not affect a different row that was never
    // holding it.
    touchStart(rowB.node, 200, 100);
    touchMove(rowB.node, 170, 100);
    touchEnd(rowB.node);
    expect(rowB.getState().offset).toBe(-RAIL_WIDTH);
  });

  test('disabled ignores all touch input', () => {
    const { node, getState } = setup({ railWidth: RAIL_WIDTH, disabled: true });

    touchStart(node, 200, 100);
    touchMove(node, 100, 100);
    touchEnd(node);

    expect(getState().offset).toBe(0);
  });
});
