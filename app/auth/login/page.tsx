"use client";

import { useState } from "react";
import Image from "next/image";
import Head from "next/head";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Group,
  Title,
  Text,
  Center,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useRedirectIfAuthenticated } from "../../../lib/useAuth";

// Define validation schema with zod
const loginSchema = z.object({
  email: z
    .string()
    .email("Неверный адрес электронной почты")
    .min(1, "Электронная почта обязательна"),
  password: z.string().min(1, "Пароль обязателен"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const auth = useRedirectIfAuthenticated();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include", // Ensure cookies are sent
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Login successful, triggering auth check...");
        setIsRedirecting(true);
        setError("");
        // Trigger auth check to update state and redirect
        await auth.checkAuth();
      } else {
        setError(result.error || "Ошибка входа");
        setIsRedirecting(false);
      }
    } catch (error) {
      setError("Ошибка сети. Попробуйте еще раз.");
      setIsRedirecting(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader size="lg" className="mb-4" />
          <Text size="lg" c="gray.6">
            Проверка авторизации...
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Center>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo.svg"
                alt="Topex Logistics Logo"
                width={120}
                height={120}
                className="h-20 w-auto"
                priority
              />
            </div>
            <Title order={2} className="text-gray-900 mb-2">
              Topex Logistics
            </Title>
            <Title order={3} className="text-gray-700 mb-2">
              Панель Администратора
            </Title>
            <Text size="sm" c="gray.6">
              Войдите в свою учетную запись для продолжения
            </Text>
          </div>
        </Center>

        <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  label="Электронная почта"
                  placeholder="Введите вашу электронную почту"
                  error={errors.email?.message}
                  required
                  radius="md"
                  size="md"
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <PasswordInput
                  {...field}
                  label="Пароль"
                  placeholder="Введите ваш пароль"
                  error={errors.password?.message}
                  required
                  radius="md"
                  size="md"
                />
              )}
            />

            {error && (
              <Alert
                variant="light"
                color="red"
                title="Ошибка"
                icon={<IconAlertCircle size={16} />}
              >
                {error}
              </Alert>
            )}

            {isRedirecting && (
              <Alert
                variant="light"
                color="green"
                title="Успешно"
                icon={<IconCheck size={16} />}
              >
                Вход выполнен успешно! Перенаправление в панель
                администратора...
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              loading={isLoading || isRedirecting}
              disabled={isLoading || isRedirecting}
              radius="md"
              size="md"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRedirecting ? (
                <Group>Перенаправление в панель администратора...</Group>
              ) : isLoading ? (
                <Group>Вход в систему...</Group>
              ) : (
                "Войти"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
