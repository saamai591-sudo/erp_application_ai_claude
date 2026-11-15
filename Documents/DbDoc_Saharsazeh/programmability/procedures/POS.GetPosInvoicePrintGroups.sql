
------------------------------------- START #7944
CREATE   PROCEDURE [POS].[GetPosInvoicePrintGroups]
(
    @PosInvoiceId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        sps.StationPrintGroupID AS [Value],
        sps.PrinterName AS Value1
    FROM POS.PosInvoiceItem AS ofi
    JOIN POS.PosInvoice AS ofo
        ON ofo.PosInvoiceID = ofi.PosInvoiceID
    JOIN POS.StationShift AS ss
        ON ss.StationShiftID = ofo.StateShiftID
    JOIN POS.StationPrintSetting AS sps
        ON sps.StationID = ss.StationID
    WHERE ofi.PosInvoiceID = @PosInvoiceId;
END;
