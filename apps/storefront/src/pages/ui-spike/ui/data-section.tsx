import { Avatar, Table } from '@heroui/react';
import { KIND_LABELS, SAMPLE_TITLES, formatRating } from '../model/sample-titles';
import { SpikeSection } from './spike-section';

const PEOPLE = [
  { id: 'olena', initials: 'ОК', name: 'Олена' },
  { id: 'taras', initials: 'ТШ', name: 'Тарас' },
  { id: 'iryna', initials: 'ІМ', name: 'Ірина' },
];

export function DataSection() {
  return (
    <SpikeSection id="data" title="Дані (серверний компонент)">
      <ul className="flex gap-2" aria-label="Друзі">
        {PEOPLE.map((person) => (
          <li key={person.id}>
            <Avatar>
              <Avatar.Fallback aria-hidden>{person.initials}</Avatar.Fallback>
            </Avatar>
            <span className="sr-only">{person.name}</span>
          </li>
        ))}
      </ul>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Тренди тижня" className="min-w-[480px]">
            <Table.Header>
              <Table.Column isRowHeader>Назва</Table.Column>
              <Table.Column>Тип</Table.Column>
              <Table.Column>Рік</Table.Column>
              <Table.Column>Оцінка</Table.Column>
            </Table.Header>
            <Table.Body>
              {SAMPLE_TITLES.map((item) => (
                <Table.Row key={item.id} id={item.id}>
                  <Table.Cell>{item.title}</Table.Cell>
                  <Table.Cell>{KIND_LABELS[item.kind]}</Table.Cell>
                  <Table.Cell className="tabular-nums">{item.year}</Table.Cell>
                  <Table.Cell className="tabular-nums">{formatRating(item.rating)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </SpikeSection>
  );
}
