package com.imamruhollahschool.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import com.google.androidbrowserhelper.TwaLauncher;

public class MainActivity extends Activity {
    private static final String LAUNCH_URL = "https://imamruhollahschool.com/";
    private TwaLauncher twaLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        twaLauncher = new TwaLauncher(this);
        twaLauncher.launch(Uri.parse(LAUNCH_URL), null, null);
    }

    @Override
    protected void onDestroy() {
        if (twaLauncher != null) {
            twaLauncher.destroy();
        }
        super.onDestroy();
    }
}
