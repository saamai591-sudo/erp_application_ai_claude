CREATE   PROC [POS].[CalculateInstallmentAccumulationItemsForParty]
    (
      @InstallmentAccumulationId INT
    )
AS
    BEGIN

        DECLARE @userId INT = CFG.GetuserID();

        IF EXISTS ( SELECT  1
                    FROM    POS.InstallmentAccumulationCalculation
                    WHERE   InstallmentAccumulationID = @InstallmentAccumulationId )
            BEGIN
                DECLARE @Message NVARCHAR(MAX);
				SET @Message = N'StoreSale.FirstRemoveCalc'
                RAISERROR(@Message,16,13);
                RETURN; 
            END;		
			
        INSERT  POS.InstallmentAccumulationCalculation
                ( InstallmentAccumulationID ,
                  PartyID ,
                  TotalAmount ,
                  Creator ,
                  CreationDate ,
                  LastEditor ,
                  LastEditionDate ,
                  Version
	            )
                SELECT  @InstallmentAccumulationId ,
                        s.CustomerID ,
                        SUM(s.InstallmentAmount) TotalAmount ,
                        @userId ,
                        GETDATE() ,
                        @userId ,
                        GETDATE() ,
                        0
                FROM    ( SELECT    p.CustomerID ,
                                    p.TotalNetPrice
                                    - ISNULL(( SELECT   SUM(TotalAmount)
                                               FROM     POS.PosReceipt
                                               WHERE    PosInvoiceID = p.PosInvoiceID
                                             ), 0) InstallmentAmount
                          FROM      POS.InstallmentAccumulationItem i
                                    JOIN POS.PosInvoice p ON p.PosInvoiceID = i.PosInvoiceId
                          WHERE     p.HasInstallment = 1
                                    AND i.InstallmentAccumulationID = @InstallmentAccumulationId
                        ) s
                GROUP BY s.CustomerID;

    END;
