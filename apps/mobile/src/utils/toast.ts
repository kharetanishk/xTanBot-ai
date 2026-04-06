import Toast from "react-native-toast-message";

export function toastError(message: string, title = "Something went wrong") {
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 4500,
  });
}

export function toastSuccess(message: string, title = "Success") {
  Toast.show({
    type: "success",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 3000,
  });
}

export function toastInfo(message: string, title = "") {
  Toast.show({
    type: "info",
    text1: title || undefined,
    text2: message,
    position: "top",
    visibilityTime: 3500,
  });
}
