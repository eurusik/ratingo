import { render, screen } from '@testing-library/react';
import { interpolateNodes } from './interpolate-nodes';

describe('interpolateNodes', () => {
  it('puts elements in place of placeholders and keeps unknown ones', () => {
    render(<p>{interpolateNodes('Open {link} or {other}', { link: <a href="/x">site</a> })}</p>);
    expect(screen.getByRole('link', { name: 'site' })).toBeInTheDocument();
    expect(screen.getByRole('paragraph')).toHaveTextContent('Open site or {other}');
  });
});
