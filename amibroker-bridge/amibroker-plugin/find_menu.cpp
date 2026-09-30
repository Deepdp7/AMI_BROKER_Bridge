#include <windows.h>
#include <iostream>
#include <string>
#include <vector>

void PrintMenu(HMENU hMenu, int depth) {
    int count = GetMenuItemCount(hMenu);
    for (int i = 0; i < count; i++) {
        char buf[256] = {0};
        GetMenuStringA(hMenu, i, buf, sizeof(buf), MF_BYPOSITION);
        UINT id = GetMenuItemID(hMenu, i);
        
        for (int d = 0; d < depth; d++) std::cout << "  ";
        std::cout << buf;
        if (id != -1 && id != 0) {
            std::cout << " (ID: " << id << " / 0x" << std::hex << id << std::dec << ")";
        }
        std::cout << std::endl;
        
        HMENU hSub = GetSubMenu(hMenu, i);
        if (hSub) {
            PrintMenu(hSub, depth + 1);
        }
    }
}

HWND g_hWndAmiBroker = NULL;
BOOL CALLBACK EnumWindowsProc(HWND hWnd, LPARAM lParam) {
    char title[256];
    GetWindowTextA(hWnd, title, sizeof(title));
    if (strstr(title, "AmiBroker")) {
        g_hWndAmiBroker = hWnd;
        return FALSE;
    }
    return TRUE;
}

int main() {
    EnumWindows(EnumWindowsProc, 0);
    HWND hWnd = g_hWndAmiBroker;
    if (!hWnd) {
        std::cout << "AmiBroker not found" << std::endl;
        return 1;
    }
    std::cout << "AmiBroker HWND: " << hWnd << std::endl;
    HMENU hMenu = GetMenu(hWnd);
    if (hMenu) {
        PrintMenu(hMenu, 0);
    } else {
        std::cout << "No menu found" << std::endl;
    }
    return 0;
}
