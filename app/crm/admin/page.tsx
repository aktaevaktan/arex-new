"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRef } from "react";
import {
  Container,
  Title,
  Text,
  Select,
  Button,
  Alert,
  Group,
  Card,
  Stack,
  Badge,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconSend,
  IconLogout,
  IconTable,
  IconInfoCircle,
  IconRefresh,
} from "@tabler/icons-react";
import { useLocalization, LanguageSwitcher } from "../../../lib/localization";
import { useRequireAuth } from "../../../lib/useAuth";

interface Sheet {
  title: string;
  sheetId: number;
}

interface SpreadsheetInfo {
  title: string;
  sheets: Sheet[];
}

interface SheetStatus {
  sheetName: string;
  isScanned: boolean;
  scannedAt: string | null;
  statistics: {
    trackingNumbers: number;
    usersNotified: number;
    webhookEvents?: number;
  };
}

export default function AdminPage() {
  const selectRef = useRef<HTMLInputElement | null>(null);
  const { t } = useLocalization();
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [spreadsheetInfo, setSpreadsheetInfo] =
    useState<SpreadsheetInfo | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [selectedSheetStatus, setSelectedSheetStatus] =
    useState<SheetStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);

  // Require authentication for this page
  const auth = useRequireAuth();

  // Load spreadsheet info on component mount
  useEffect(() => {
    const loadSpreadsheetInfo = async () => {
      setMessage("");
      try {
        console.log("Loading spreadsheet info...");
        const response = await fetch("/api/sheets/info", {
          credentials: "include",
        });
        console.log(
          "Sheets info response:",
          response.status,
          response.statusText
        );

        if (response.ok) {
          const info: SpreadsheetInfo = await response.json();
          console.log("Sheets info loaded:", info);
          setSpreadsheetInfo(info);
          setMessage(t("admin.sheetsInfoLoaded"));
        } else {
          const errorText = await response.text();
          console.error("Sheets info error:", response.status, errorText);
          setMessage(`${t("common.error")}: ${response.status} - ${errorText}`);
        }
      } catch (error: any) {
        console.error("Sheets info fetch error:", error);
        setMessage(`${t("common.error")}: ${error.message}`);
      }
    };
    loadSpreadsheetInfo();
  }, []);

  // Reload sheet list
  const handleReloadSheetList = async () => {
    setIsRefreshing(true);
    setMessage("");
    try {
      console.log("Refreshing spreadsheet info...");
      const response = await fetch("/api/sheets/info", {
        cache: "no-store",
        credentials: "include",
      });
      console.log("Refresh response:", response.status, response.statusText);

      if (response.ok) {
        const info: SpreadsheetInfo = await response.json();
        console.log("Sheets info refreshed:", info);
        setSpreadsheetInfo(info);
        setMessage(t("admin.refreshSheets"));
      } else {
        const errorText = await response.text();
        console.error("Refresh error:", response.status, errorText);
        setMessage(`${t("common.error")}: ${response.status} - ${errorText}`);
      }
    } catch (error: any) {
      console.error("Refresh fetch error:", error);
      setMessage(`${t("common.error")}: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch sheet status
  const fetchSheetStatus = async (sheetName: string) => {
    if (!sheetName) {
      setSelectedSheetStatus(null);
      return;
    }

    setIsLoadingStatus(true);
    try {
      const response = await fetch(
        `/api/sheets/status?sheetName=${encodeURIComponent(sheetName)}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSelectedSheetStatus(result.data);
        } else {
          console.error("Failed to fetch sheet status:", result.error);
          setSelectedSheetStatus(null);
        }
      } else {
        console.error("Failed to fetch sheet status");
        setSelectedSheetStatus(null);
      }
    } catch (error) {
      console.error("Error fetching sheet status:", error);
      setSelectedSheetStatus(null);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Send broadcast
  const handleSendBroadcast = async () => {
    if (!selectedSheet) {
      setMessage(t("admin.selectSheetFirst"));
      return;
    }
    setIsSending(true);
    setMessage(t("common.loading"));
    try {
      // Set longer timeout for bulk operations (5 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch("/api/sheets/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSheet }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: { success: boolean; message: string } =
        await response.json();

      // Parse success message for localization
      if (result.success && result.message.includes("Successfully sent")) {
        const match = result.message.match(
          /Successfully sent (\d+) new orders\. (\d+) orders were already sent before\./
        );
        if (match) {
          const newCount = match[1];
          const alreadySent = match[2];
          setMessage(
            t("admin.successfullySent", {
              count: newCount,
              alreadySent: alreadySent,
            })
          );
        } else {
          setMessage(result.message);
        }
      } else if (
        result.success &&
        result.message.includes("No new orders to send")
      ) {
        const match = result.message.match(
          /No new orders to send\. All (\d+) orders were already sent before\./
        );
        if (match) {
          const count = match[1];
          setMessage(t("admin.noNewOrders", { count: count }));
        } else {
          setMessage(result.message);
        }
      } else {
        setMessage(result.message);
      }

      // Refresh sheet status after successful processing
      if (result.success && selectedSheet) {
        console.log(
          "🔄 Refreshing sheet status after successful processing..."
        );
        // Set loading state for status refresh
        setIsLoadingStatus(true);
        setTimeout(() => {
          fetchSheetStatus(selectedSheet);
        }, 1000); // Small delay to ensure database is updated
      }
    } catch (error: any) {
      setMessage(t("common.error"));
    } finally {
      setIsSending(false);
    }
  };

  // Logout functionality
  const handleLogout = async () => {
    await auth.logout();
  };

  // Sheet options for select dropdown
  const sheetOptions =
    spreadsheetInfo?.sheets.map((sheet) => ({
      value: sheet.title,
      label: sheet.title,
    })) || [];

  // Show loading screen while checking authentication
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm shadow-xl border-b border-gray-200/50 sticky top-0 z-50">
        <Container size="xl">
          <Group justify="space-between" py="md">
            <Group gap="md">
              <div className="relative">
                <Image
                  src="/logo.svg"
                  alt="Логотип Topex Logistics"
                  width={48}
                  height={48}
                  className="h-10 w-10 sm:h-12 sm:w-12 transition-transform hover:scale-105"
                />
                {isRefreshing && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <div>
                <Title
                  order={1}
                  c="gray.9"
                  className="font-bold text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl"
                >
                  Topex Logistics
                </Title>
                <Text
                  c="gray.6"
                  className="hidden sm:block font-medium text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl"
                >
                  {t("admin.title")}
                </Text>
              </div>
            </Group>
            <Group gap="sm">
              <LanguageSwitcher />
              <Button
                onClick={handleLogout}
                color="red"
                leftSection={
                  <IconLogout
                    size={14}
                    className="hidden sm:block md:w-4 md:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6"
                  />
                }
                variant="filled"
                size="sm"
                className="shadow-lg hover:shadow-xl transition-all duration-200 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-medium px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 h-8 sm:h-9 md:h-10 lg:h-12 xl:h-14"
              >
                <span className="block sm:hidden">{t("auth.logout")}</span>
                <span className="hidden sm:block">{t("auth.logout")}</span>
              </Button>
            </Group>
          </Group>
        </Container>
      </div>

      {/* Main Content */}
      <Container size="lg" py="xl">
        <Card
          shadow="xl"
          radius="xl"
          withBorder
          className="bg-white/80 backdrop-blur-sm border-gray-200/50"
        >
          <Stack gap="xl">
            <div className="text-center">
              <Title
                order={2}
                mb="xs"
                className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl"
              >
                <span className="block sm:hidden">{t("admin.sheetsInfo")}</span>
                <span className="hidden sm:block">{t("admin.sheetsInfo")}</span>
              </Title>
              <Text
                c="gray.6"
                className="font-medium text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl"
              >
                {spreadsheetInfo ? (
                  <>
                    <span className="block sm:hidden">
                      📊 {spreadsheetInfo.title}
                    </span>
                    <span className="hidden sm:block">
                      📊 {spreadsheetInfo.title}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block sm:hidden">
                      ⏳ {t("common.loading")}
                    </span>
                    <span className="hidden sm:block">
                      ⏳ {t("common.loading")}
                    </span>
                  </>
                )}
              </Text>
              {spreadsheetInfo && (
                <Badge
                  variant="light"
                  color="blue"
                  size="md"
                  mt="xs"
                  className="text-xs sm:text-sm md:text-base lg:text-lg"
                >
                  {spreadsheetInfo.sheets.length} {t("admin.totalSheets")}
                </Badge>
              )}
            </div>

            {/* Sheet Selection */}
            <div>
              <Select
                ref={selectRef}
                label={t("admin.selectSheet")}
                placeholder={t("admin.selectSheet")}
                value={selectedSheet}
                onChange={(value) => {
                  const sheetName = value || "";
                  setSelectedSheet(sheetName);
                  // Fetch sheet status when a sheet is selected
                  fetchSheetStatus(sheetName);
                  // Blur after selecting
                  if (selectRef.current) {
                    selectRef.current.blur();
                  }
                }}
                data={sheetOptions}
                disabled={isRefreshing || isSending}
                leftSection={<IconTable size={16} />}
                radius="md"
                size="md"
                searchable
                clearable
                nothingFoundMessage="Лист не найден"
                className="text-sm sm:text-base md:text-lg lg:text-xl"
                styles={{
                  label: {
                    fontSize: "12px",
                    fontWeight: 500,
                    "@media (min-width: 640px)": {
                      fontSize: "14px",
                    },
                    "@media (min-width: 768px)": {
                      fontSize: "16px",
                    },
                    "@media (min-width: 1024px)": {
                      fontSize: "18px",
                    },
                    "@media (min-width: 1280px)": {
                      fontSize: "20px",
                    },
                  },
                  input: {
                    fontSize: "12px",
                    "@media (min-width: 640px)": {
                      fontSize: "14px",
                    },
                    "@media (min-width: 768px)": {
                      fontSize: "16px",
                    },
                    "@media (min-width: 1024px)": {
                      fontSize: "18px",
                    },
                    "@media (min-width: 1280px)": {
                      fontSize: "20px",
                    },
                  },
                  dropdown: {
                    fontSize: "12px",
                    "@media (min-width: 640px)": {
                      fontSize: "14px",
                    },
                    "@media (min-width: 768px)": {
                      fontSize: "16px",
                    },
                    "@media (min-width: 1024px)": {
                      fontSize: "18px",
                    },
                    "@media (min-width: 1280px)": {
                      fontSize: "20px",
                    },
                  },
                }}
              />
            </div>

            {/* Sheet Status Information */}
            {selectedSheet && (
              <Card withBorder radius="md" className="bg-gray-50">
                <Stack gap="xs">
                  <Text size="sm" fw={600} className="text-gray-700">
                    {t("admin.sheetStatus.statistics")}
                  </Text>

                  {isLoadingStatus ? (
                    <Text size="sm" c="dimmed">
                      {t("admin.sheetStatus.loadingStatus")}
                    </Text>
                  ) : selectedSheetStatus ? (
                    <Stack gap="xs">
                      {/* Scan Status */}
                      <Group gap="xs">
                        <Badge
                          color={
                            selectedSheetStatus.isScanned ? "green" : "gray"
                          }
                          variant="light"
                          size="sm"
                        >
                          {selectedSheetStatus.isScanned
                            ? t("admin.sheetStatus.scanned")
                            : t("admin.sheetStatus.notScanned")}
                        </Badge>
                        {selectedSheetStatus.isScanned &&
                          selectedSheetStatus.scannedAt && (
                            <Text size="xs" c="dimmed">
                              {t("admin.sheetStatus.scannedAt", {
                                date: new Date(
                                  selectedSheetStatus.scannedAt
                                ).toLocaleDateString("ru-RU"),
                                time: new Date(
                                  selectedSheetStatus.scannedAt
                                ).toLocaleTimeString("ru-RU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                              })}
                            </Text>
                          )}
                      </Group>

                      {/* Statistics */}
                      {selectedSheetStatus.isScanned && (
                        <Group gap="md">
                          <Text size="xs" c="dimmed">
                            {t("admin.sheetStatus.usersNotified", {
                              count:
                                selectedSheetStatus.statistics.usersNotified,
                            })}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {t("admin.sheetStatus.trackingNumbers", {
                              count:
                                selectedSheetStatus.statistics.trackingNumbers,
                            })}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {t("admin.sheetStatus.noData")}
                    </Text>
                  )}
                </Stack>
              </Card>
            )}

            {/* Action Buttons */}
            <Stack gap="md">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={handleReloadSheetList}
                  disabled={isRefreshing || isSending}
                  loading={isRefreshing}
                  leftSection={
                    <IconRefresh
                      size={16}
                      className="hidden sm:block md:w-5 md:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7"
                    />
                  }
                  variant="gradient"
                  gradient={{ from: "blue", to: "cyan" }}
                  size="md"
                  className="shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl sm:font-semibold h-10 sm:h-12 md:h-14 lg:h-16 xl:h-18 flex-1"
                >
                  <span className="block sm:hidden">
                    {isRefreshing
                      ? t("common.loading")
                      : t("admin.refreshSheets")}
                  </span>
                  <span className="hidden sm:block">
                    {isRefreshing
                      ? t("common.loading")
                      : t("admin.refreshSheets")}
                  </span>
                </Button>

                <Button
                  onClick={handleSendBroadcast}
                  disabled={!selectedSheet || isSending}
                  loading={isSending}
                  leftSection={
                    <IconSend
                      size={16}
                      className="hidden sm:block md:w-5 md:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7"
                    />
                  }
                  variant="filled"
                  color="green"
                  size="md"
                  className="shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl sm:font-semibold h-10 sm:h-12 md:h-14 lg:h-16 xl:h-18 flex-1"
                >
                  <span className="block sm:hidden">
                    {isSending
                      ? t("admin.sendingRassilka")
                      : t("admin.sendRassilka")}
                  </span>
                  <span className="hidden sm:block">
                    {isSending
                      ? t("admin.sendingRassilka")
                      : t("admin.sendRassilka")}
                  </span>
                </Button>
              </div>
            </Stack>

            {/* Status Messages */}
            {message && (
              <Alert
                variant="light"
                color={
                  message.includes("Error") ||
                  message.includes("Ошибка") ||
                  message.includes("Ката")
                    ? "red"
                    : "green"
                }
                title={
                  message.includes("Error") ||
                  message.includes("Ошибка") ||
                  message.includes("Ката")
                    ? t("common.error")
                    : t("common.success")
                }
                icon={<IconInfoCircle size={16} />}
              >
                {message}
              </Alert>
            )}

            {/* Info Card */}
            <Alert
              variant="light"
              color="blue"
              title={
                <span className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
                  <span className="block sm:hidden">
                    {t("admin.instructions")}
                  </span>
                  <span className="hidden sm:block">
                    {t("admin.instructions")}
                  </span>
                </span>
              }
              icon={
                <IconInfoCircle
                  size={16}
                  className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8"
                />
              }
            >
              <Stack gap="xs">
                <Text className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
                  1. {t("admin.instructionText1")}
                </Text>
                <Text className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
                  2. {t("admin.instructionText2")}
                </Text>
                <Text className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
                  3. {t("admin.instructionText3")}
                </Text>
              </Stack>
            </Alert>
          </Stack>
        </Card>
      </Container>
    </div>
  );
}
