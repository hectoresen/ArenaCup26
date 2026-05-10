import { type RenderOptions, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import esMessages from "../../messages/es.json";

type Messages = typeof esMessages;

type Options = Omit<RenderOptions, "wrapper"> & {
  locale?: string;
  messages?: Messages;
};

/**
 * Helper para tests de componentes que usan `useTranslations` de
 * next-intl. Por defecto usa los mensajes en español; se puede
 * sobreescribir pasando otro fichero JSON.
 */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { locale = "es", messages = esMessages as Messages, ...rest } = options;

  function Wrapper({ children }: { children: ReactElement }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
