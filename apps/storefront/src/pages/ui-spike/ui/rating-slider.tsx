'use client';

import { useState } from 'react';
import { Label, Slider } from '@heroui/react';

const RATING_MIN = 1;
const RATING_MAX = 10;
const DEFAULT_RATING = 7;

function firstValue(value: number | number[]): number {
  return Array.isArray(value) ? (value[0] ?? DEFAULT_RATING) : value;
}

export function RatingSlider() {
  const [rating, setRating] = useState(DEFAULT_RATING);

  return (
    <Slider
      minValue={RATING_MIN}
      maxValue={RATING_MAX}
      value={rating}
      onChange={(value) => setRating(firstValue(value))}
    >
      <Label>Ваша оцінка</Label>
      <Slider.Output className="tabular-nums" />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}
