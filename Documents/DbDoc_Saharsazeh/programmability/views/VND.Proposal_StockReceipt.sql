
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 ÕÈÍ
 ************************************************************/

CREATE VIEW [VND].[Proposal_StockReceipt]
AS
    SELECT  sri.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    STC.StockReceiptItem AS sri
    WHERE   sri.ProposalItemID IS NOT NULL
    UNION
    SELECT  pii.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseInvoiceItem AS pii
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
    WHERE   pii.ProposalItemID IS NOT NULL
    UNION
    SELECT  tsri.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    STC.TemporaryStockReceiptItem AS tsri
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   tsri.ProposalItemID IS NOT NULL
    UNION
    SELECT  jii.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    STC.JustificationInputItem AS jii
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   jii.ProposalItemID IS NOT NULL
	UNION
	SELECT  pci.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
	INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseContractItemID = pci.PurchaseContractItemID
    WHERE   pci.ProposalItemID IS NOT NULL

    UNION
    SELECT  pci.ProposalItemID ,
            sri.StockReceiptItemID
    FROM     VND.PurchaseContractItem pci
			INNER JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION


    SELECT  pci.ProposalItemID ,
            sri.StockReceiptItemID
    FROM     VND.PurchaseContractItem pci
			INNER JOIN 	STC.TemporaryStockReceiptItem AS tsri ON tsri.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.JustificationInputItem AS jii ON jii.TemporaryStockReceiptItemID = tsri.TemporaryStockReceiptItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pci.ProposalItemID IS NOT NULL
    UNION
    SELECT  pci.ProposalItemID ,
            sri.StockReceiptItemID
    FROM    VND.PurchaseContractItem pci
			INNER JOIN STC.JustificationInputItem AS jii ON jii.PurchaseContractItemID = pci.PurchaseContractItemID
            INNER JOIN STC.StockReceiptItem AS sri ON sri.JustificationInputItemID = jii.JustificationInputItemID
    WHERE   pci.ProposalItemID IS NOT NULL
