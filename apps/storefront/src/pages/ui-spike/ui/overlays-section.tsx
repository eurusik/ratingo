import { Button, Drawer, Modal, Popover, Tooltip } from '@heroui/react';
import { DismissOnSystemBack, ViewportBottomFill } from '@ratingo/ui/overlay';
import { EpisodesSheet } from './episodes-sheet';
import { SpikeSection } from './spike-section';

export function OverlaysSection() {
  return (
    <SpikeSection id="overlays" title="Оверлеї (серверний компонент)">
      <div className="flex flex-wrap gap-2">
        <Modal>
          <Button variant="secondary">Діалог</Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog>
                <ViewportBottomFill tone="backdrop" />
                <DismissOnSystemBack />
                <Modal.CloseTrigger aria-label="Закрити" />
                <Modal.Header>
                  <Modal.Heading>Видалити зі збереженого?</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p>Фокус лишається всередині, Esc закриває, фон не прокручується.</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary">
                    Скасувати
                  </Button>
                  <Button slot="close" variant="danger">
                    Видалити
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>

        <Drawer>
          <Button variant="secondary">Drawer знизу</Button>
          <Drawer.Backdrop>
            <Drawer.Content placement="bottom">
              <Drawer.Dialog>
                <ViewportBottomFill tone="panel" />
                <DismissOnSystemBack />
                <Drawer.Handle />
                <Drawer.Header>
                  <Drawer.Heading>Фільтри</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <p>Потягніть за ручку або заголовок вниз, щоб закрити.</p>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button slot="close" fullWidth>
                    Застосувати
                  </Button>
                </Drawer.Footer>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <EpisodesSheet />

        <Popover>
          <Button variant="secondary">Popover</Button>
          <Popover.Content className="max-w-64">
            <Popover.Dialog>
              <Popover.Heading>Як рахується оцінка</Popover.Heading>
              <p className="mt-2 text-sm text-muted">Популярність 40%, якість 40%, свіжість 20%.</p>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        <Tooltip>
          <Tooltip.Trigger>
            <Button variant="secondary">Tooltip</Button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <Tooltip.Arrow />
            На дотик не показується, лише на hover і фокус
          </Tooltip.Content>
        </Tooltip>
      </div>
    </SpikeSection>
  );
}
