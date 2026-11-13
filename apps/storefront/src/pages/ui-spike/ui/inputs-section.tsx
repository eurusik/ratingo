'use client';

import { Checkbox, Label, ListBox, Select, Tabs } from '@heroui/react';
import { RatingSlider } from './rating-slider';
import { SpikeSection } from './spike-section';
import { ThemeSwitch } from './theme-switch';
import { TitleAutocomplete } from './title-autocomplete';

export function InputsSection() {
  return (
    <SpikeSection id="inputs" title="Поля вводу (клієнтський компонент)">
      <ThemeSwitch />

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Тип контенту">
            <Tabs.Tab id="all">
              Усе
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="movies">
              Фільми
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="shows">
              Серіали
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel className="pt-3" id="all">
          Усі новинки тижня.
        </Tabs.Panel>
        <Tabs.Panel className="pt-3" id="movies">
          Фільми, що зараз у тренді.
        </Tabs.Panel>
        <Tabs.Panel className="pt-3" id="shows">
          Серіали з новими епізодами.
        </Tabs.Panel>
      </Tabs>

      <Select placeholder="Оберіть країну">
        <Label>Регіон стримінгу</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ua" textValue="Україна">
              Україна
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="pl" textValue="Польща">
              Польща
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="us" textValue="США">
              США
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <TitleAutocomplete />

      <RatingSlider />

      <Checkbox defaultSelected>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Сповіщати про нові епізоди
        </Checkbox.Content>
      </Checkbox>
    </SpikeSection>
  );
}
