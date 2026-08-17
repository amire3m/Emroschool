package com.imamruhollahschool.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.androidbrowserhelper.TwaLauncher;

public class MainActivity extends Activity {
    private static final String LAUNCH_URL = "https://imamruhollahschool.com/";
    private TwaLauncher twaLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        twaLauncher = new TwaLauncher(this);
        launchTwa();
    }

    private void launchTwa() {
        TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder.Builder()
            .setUri(Uri.parse(LAUNCH_URL))
            .build();
        twaLauncher.launch(builder, null, null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    protected void onDestroy() {
        if (twaLauncher != null) {
            twaLauncher.destroy();
        }
        super.onDestroy();
    }
}
