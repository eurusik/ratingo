/**
 * Public API for the person module.
 *
 * Only tokens + types are exported — never implementations.
 */

export {
  PERSON_CREDITS_WRITER,
  type IPersonCreditsWriter,
} from '../domain/ports/person-credits-writer.port';
