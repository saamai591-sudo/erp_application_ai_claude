CREATE   PROC [POS].[spPosInvoiceDelete]
    @PosInvoiceID INT ,
    @Version INT
AS
    SET NOCOUNT ON;

    DECLARE @date DATE ,
            @financialPeriod INT;

    EXEC CFG.CheckWithVatAndSeason @Date = @date ,                        -- date
                                   @FinancialPeriodId = @financialPeriod; -- int


    IF @Version = (   SELECT [Version]
                      FROM   [POS].[PosInvoice]
                      WHERE  [PosInvoiceID] = @PosInvoiceID )
        BEGIN



            DELETE FROM [POS].[PosInvoice]
            WHERE [PosInvoiceID] = @PosInvoiceID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' , -- Message text.
                      16 ,               -- Severity,
                      10 ,               -- State,
                      N'PosInvoice' ,    -- First argument.
                      @PosInvoiceID); -- Second argument.)
        END;

