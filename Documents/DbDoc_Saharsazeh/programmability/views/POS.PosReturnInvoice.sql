
CREATE VIEW [POS].[PosReturnInvoice]
AS
    SELECT  pi1.PosInvoiceID ,
            pi1.FinancialPeriodID ,
            pi1.Number ,
            pi1.IsReturnInvoice ,
            pi1.Date ,
            pi1.StateShiftID ,
            pi1.StockID ,
            pi1.CustomerID ,
            pi1.TotalPrice ,
            pi1.TotalDiscount ,
            pi1.TotalNetPrice ,
            pi1.TotalTax ,
            pi1.TotalDuty ,
            pi1.HasInstallment ,
            pi1.HasCredit ,
            pi1.Version ,
            pi1.Creator ,
            pi1.CreationDate ,
            pi1.LastEditor ,
            pi1.LastEditionDate ,
            pi1.STATUS,
            ss.StationID
    FROM    POS.PosInvoice pi1
    JOIN pos.StationShift AS ss ON ss.StationShiftID = pi1.StateShiftID
    WHERE   ( IsReturnInvoice = 1 );
