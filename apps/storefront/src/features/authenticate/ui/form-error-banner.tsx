import { Alert } from '@heroui/react';

export function FormErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
