#include <windows.h>
#include <comdef.h>
#include <iostream>

int main() {
    CoInitialize(NULL);
    CLSID clsid;
    if (SUCCEEDED(CLSIDFromProgID(L"Broker.Application", &clsid))) {
        IDispatch* pApp = NULL;
        if (SUCCEEDED(CoCreateInstance(clsid, NULL, CLSCTX_LOCAL_SERVER | CLSCTX_INPROC_SERVER, IID_IDispatch, (void**)&pApp))) {
            DISPID dispid;
            OLECHAR* name = (OLECHAR*)L"RefreshAll";
            if (SUCCEEDED(pApp->GetIDsOfNames(IID_NULL, &name, 1, LOCALE_USER_DEFAULT, &dispid))) {
                DISPPARAMS params = { NULL, NULL, 0, 0 };
                VARIANT varResult;
                VariantInit(&varResult);
                HRESULT hr = pApp->Invoke(dispid, IID_NULL, LOCALE_USER_DEFAULT, DISPATCH_METHOD, &params, &varResult, NULL, NULL);
                if (SUCCEEDED(hr)) {
                    std::cout << "RefreshAll invoked successfully" << std::endl;
                } else {
                    std::cout << "Invoke failed: " << std::hex << hr << std::endl;
                }
            } else {
                std::cout << "GetIDsOfNames failed" << std::endl;
            }
            pApp->Release();
        } else {
            std::cout << "CoCreateInstance failed" << std::endl;
        }
    } else {
        std::cout << "CLSIDFromProgID failed" << std::endl;
    }
    CoUninitialize();
    return 0;
}
