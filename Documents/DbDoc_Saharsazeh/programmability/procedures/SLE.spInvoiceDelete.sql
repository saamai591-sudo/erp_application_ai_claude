
-------------------------------------

CREATE   PROC [SLE].[spInvoiceDelete]
    @InvoiceID INT ,
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

        SELECT @PreVersion = [Version] ,
               @PreDate = [Date] ,
               @financialPeriod = FinancialPeriodID ,
               @prePrevoucherID = PreVoucherID
        FROM   [SLE].[Invoice]
        WHERE  [InvoiceID] = @InvoiceID;

        EXEC CFG.CheckWithVatAndSeason @Date = @PreDate ,                     -- date
                                       @FinancialPeriodId = @financialPeriod; -- int

        IF EXISTS (   SELECT 1
                      FROM   CFG.InstallmentPayment
                      WHERE  BaseType = 2
                             AND DocumentID = @InvoiceID )
            BEGIN

                SET @Message = 'InvoiceDeleteHasInstallment';
                RAISERROR(@Message, 16, 12);
            END;

        DECLARE @status TINYINT;
        SELECT @status = SaleInvoiceStatus
        FROM   SLE.Invoice
        WHERE  InvoiceID = @InvoiceID;
        IF ( @status = 2 )
            BEGIN
                SET @Message = 'ItIsNotPossibleToDeleteInTheConfirmedStatus';
                RAISERROR(@Message, 16, 12);
            END;

        IF @prePrevoucherID IS NOT NULL
            BEGIN

                RAISERROR('UnableToDeletePrevoucher', 16, 12);
                RETURN;

            END;

        IF @Version = @PreVersion
            BEGIN

                DECLARE @ItemID INT ,
                        @ItemVersion INT;

                DECLARE db_cursor CURSOR FOR
                    SELECT InvoiceItemID ,
                           Version
                    FROM   [SLE].[InvoiceItem]
                    WHERE  [InvoiceID] = @InvoiceID;

                OPEN db_cursor;
                FETCH NEXT FROM db_cursor
                INTO @ItemID ,
                     @ItemVersion;

                WHILE @@FETCH_STATUS = 0
                    BEGIN

                        EXEC [SLE].spInvoiceItemDelete @ItemID ,
                                                       @ItemVersion;

                        FETCH NEXT FROM db_cursor
                        INTO @ItemID ,
                             @ItemVersion;
                    END;

                CLOSE db_cursor;
                DEALLOCATE db_cursor;

                DELETE CFG.EntityCustomeFieldData
                WHERE EntityCustomeFieldID IN (   SELECT EntityCustomeFieldID
                                                  FROM   CFG.EntityCustomeField
                                                  WHERE  EntityName = 'Invoice' )
                      AND EntityID = @InvoiceID;

                DELETE FROM [SLE].[Invoice]
                WHERE [InvoiceID] = @InvoiceID;

            END;
        ELSE
            BEGIN

                RAISERROR(N'Delete_%s_%d.' , -- Message text.
                          16 ,               -- Severity,
                          10 ,               -- State,
                          N'Invoice' ,       -- First argument.
                          @InvoiceID); -- Second argument.)
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

        IF ( ERROR_NUMBER() = 547 )
            SET @ErrorState = 11;
        RAISERROR(@ErrorMessage ,  -- Message text.
                  @ErrorSeverity , -- Severity.
                  @ErrorState      -- State.
        );

    END CATCH;
