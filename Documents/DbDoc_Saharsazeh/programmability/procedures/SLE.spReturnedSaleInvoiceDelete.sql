
CREATE   PROC [SLE].[spReturnedSaleInvoiceDelete]
    @ReturnedSaleInvoiceID INT ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @financialPeriod INT ,
                @PreDate DATE ,
                @PreVersion INT ,
                @prePrevoucherID INT ,
                @Message NVARCHAR(MAX);

        SELECT @PreDate = [Date] ,
               @PreVersion = [Version] ,
               @prePrevoucherID = PreVoucherID,
			   @financialPeriod= FinancialPeriodID
        FROM   [SLE].[ReturnedSaleInvoice]
        WHERE  [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;

		EXEC CFG.CheckWithVatAndSeason @Date = @PreDate , -- date
		                               @FinancialPeriodId = @financialPeriod -- int

        IF @prePrevoucherID IS NOT NULL
            BEGIN
                RAISERROR('UnableToDeletePrevoucher', 16, 12);
                RETURN;
            END;
            
        DECLARE @HasFlow BIT = (SELECT [SLE].[ReturnedSaleInvoiceHasFlow](@ReturnedSaleInvoiceID) )
        IF (@HasFlow = 1)
        BEGIN
            RAISERROR('HasFlowItemCanNotEdit', 16, 12);
            RETURN;
        END;

        IF @Version = @PreVersion
            BEGIN
                DECLARE @ItemID INT ,
                        @ItemVersion INT;

                DECLARE db_cursor CURSOR FOR
                    SELECT ReturnedSaleInvoiceItemID ,
                           Version
                    FROM   [SLE].[ReturnedSaleInvoiceItem]
                    WHERE  [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;

                OPEN db_cursor;
                FETCH NEXT FROM db_cursor
                INTO @ItemID ,
                     @ItemVersion;

                WHILE @@FETCH_STATUS = 0
                    BEGIN

                        EXEC [SLE].spReturnedSaleInvoiceItemDelete @ItemID ,
                                                                   @ItemVersion;

                        FETCH NEXT FROM db_cursor
                        INTO @ItemID ,
                             @ItemVersion;
                    END;

                CLOSE db_cursor;
                DEALLOCATE db_cursor;

                DELETE FROM [SLE].[ReturnedSaleInvoice]
                WHERE [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;

            END;
        ELSE
            BEGIN
                RAISERROR(N'Delete_%s_%d.' ,       -- Message text.
                          16 ,                     -- Severity,
                          10 ,                     -- State,
                          N'ReturnedSaleInvoice' , -- First argument.
                          @ReturnedSaleInvoiceID); -- Second argument.)
            END;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('global', 'db_cursor') = 1
            BEGIN
                CLOSE db_cursor;
                DEALLOCATE db_cursor;
            END;
        DECLARE @ErrorMessage NVARCHAR(4000);
        DECLARE @ErrorSeverity INT;
        DECLARE @ErrorState INT;

        SELECT @ErrorMessage = ERROR_MESSAGE() ,
               @ErrorSeverity = ERROR_SEVERITY() ,
               @ErrorState = ERROR_STATE();


        RAISERROR(@ErrorMessage ,  -- Message text.
                  @ErrorSeverity , -- Severity.
                  @ErrorState      -- State.
        );

    END CATCH;
