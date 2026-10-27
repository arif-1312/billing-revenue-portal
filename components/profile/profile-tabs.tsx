"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLock, IconUserCircle } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  changeCurrentUserPassword,
  updateCurrentUserProfile,
} from "@/lib/actions/users";
import { sendMyPasswordResetLink } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type ProfileUser = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type InformationForm = {
  firstName: string;
  lastName: string;
};

const initialPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ProfileTabs({
  user,
}: {
  user: ProfileUser;
}) {
  const router = useRouter();
  const [informationForm, setInformationForm] =
    useState<InformationForm>({
      firstName: user.firstName,
      lastName: user.lastName,
    });
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(initialPasswordForm);
  const [isUpdatingInfo, startInfoTransition] =
    useTransition();
  const [isUpdatingPassword, startPasswordTransition] =
    useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [isSendingReset, startResetTransition] = useTransition();

  const updateInformationField = (
    key: keyof InformationForm,
    value: string,
  ) => {
    setInformationForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleInformationSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    startInfoTransition(async () => {
      const result = await updateCurrentUserProfile(
        informationForm,
      );

      if (!result?.success) {
        toast.error("Error", {
          description:
            result?.message ||
            "Unable to update profile",
        });
        return;
      }

      toast.success("Success", {
        description: result.message,
      });

      router.refresh();
    });
  };

  const updatePasswordField = (
    key: keyof PasswordForm,
    value: string,
  ) => {
    setPasswordForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePasswordSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    startPasswordTransition(async () => {
      try {
        const result = await changeCurrentUserPassword(
          passwordForm,
        );

        if (!result?.success) {
          toast.error("Error", {
            description:
              result?.message ||
              "Unable to update password",
          });
          return;
        }

        setPasswordForm(initialPasswordForm);

        toast.success("Success", {
          description: result.message,
        });
      } catch (error) {
        console.error("Password update failed:", error);

        toast.error("Error", {
          description:
            "Something went wrong while updating the password",
        });
      }
    });
  };

  return (
    <Tabs
      defaultValue="information"
      className="w-full space-y-6"
    >
      <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <TabsTrigger value="information">
          Information
        </TabsTrigger>
        <TabsTrigger value="password">
          Password
        </TabsTrigger>
      </TabsList>

      <TabsContent value="information">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700">
                <IconUserCircle className="size-5" />
              </div>
              <div>
                <CardTitle>
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your account details are shown here.
                  Username and email stay locked.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleInformationSubmit}
              className="grid gap-6 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={informationForm.firstName}
                  onChange={(event) =>
                    updateInformationField(
                      "firstName",
                      event.target.value,
                    )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={informationForm.lastName}
                  onChange={(event) =>
                    updateInformationField(
                      "lastName",
                      event.target.value,
                    )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user.username}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={isUpdatingInfo}
                  className="min-w-40"
                >
                  {isUpdatingInfo
                    ? "Updating..."
                    : "Update Information"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="password">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
                <IconLock className="size-5" />
              </div>
              <div>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Enter your current password and set a
                  new one.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handlePasswordSubmit}
              className="grid gap-6 md:grid-cols-2"
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="currentPassword">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    updatePasswordField(
                      "currentPassword",
                      event.target.value,
                    )}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    updatePasswordField(
                      "newPassword",
                      event.target.value,
                    )}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    updatePasswordField(
                      "confirmPassword",
                      event.target.value,
                    )}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="min-w-40"
                >
                  {isUpdatingPassword
                    ? "Updating..."
                    : "Update Password"}
                </Button>
                {confirmReset ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSendingReset}
                    onClick={() => {
                      startResetTransition(async () => {
                        const result = await sendMyPasswordResetLink();
                        setConfirmReset(false);
                        if (result.success) toast.success(result.message);
                        else toast.error(result.message);
                      });
                    }}
                  >
                    {isSendingReset ? "Sending..." : "Send reset link"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmReset(true)}
                  >
                    Reset Password
                  </Button>
                )}
                {confirmReset ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
              {confirmReset ? (
                <p className="md:col-span-2 text-sm text-slate-500">
                  This sends a one-time reset link to your registered email address. It expires in 15 minutes.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
