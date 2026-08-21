package com.imamruhollahschool.app;

import android.net.Uri;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class MainActivity extends LauncherActivity {
    @Override
    protected Uri getLaunchingUrl() {
        return Uri.parse("https://imamruhollahschool.com/");
    }
}
