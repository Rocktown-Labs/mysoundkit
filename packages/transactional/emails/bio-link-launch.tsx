import { BioLinkLaunchEmail } from "../src";
import type { BioLinkLaunchEmailProps } from "../src";

const BioLinkLaunchEmailPreview =
  BioLinkLaunchEmail as typeof BioLinkLaunchEmail & {
    PreviewProps: BioLinkLaunchEmailProps;
  };

BioLinkLaunchEmailPreview.PreviewProps = {
  artistName: "there",
  assetBaseUrl: "https://mysoundkit.com",
  dashboardUrl: "https://mysoundkit.com/dashboard",
  username: "cgstewart",
} satisfies BioLinkLaunchEmailProps;

export default BioLinkLaunchEmailPreview;
