CREATE   PROC [ACC].[spVoucherItemUpdate]
    @VoucherItemID INT,
    @Version INT,

    @VoucherID INT,
    @VoucherItemIndex INT,
    @SlID INT,
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @Debit DECIMAL(36, 10),
    @Credit DECIMAL(36, 10),
    @CurrencyID INT,
    @CurrencyRate DECIMAL(36, 10),
    @CurrencyDebit DECIMAL(36, 10),
    @CurrencyCredit DECIMAL(36, 10),
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS
SET NOCOUNT ON;
    DECLARE @Message NVARCHAR(MAX);
    DECLARE @PreSlID INT,
            @PreVersion INT,
            @DocumentTypeID INT;

    SELECT @PreVersion = [VoucherItem].[Version],
           @PreSlID = SlID,
           @DocumentTypeID = v.DocumentTypeID
    FROM [ACC].[VoucherItem]
        JOIN ACC.Voucher AS v
            ON v.VoucherID = VoucherItem.VoucherID
    WHERE [VoucherItemID] = @VoucherItemID;

    IF @DocumentTypeID = 8
    BEGIN
        UPDATE ACC.VoucherItem
        SET Description = @Description,
            Description2 = @Description2,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version + 1
        WHERE [VoucherItemID] = @VoucherItemID;
    END;
    ELSE
    BEGIN

        IF @CurrencyID = 0
            SET @CurrencyID = -1;

        IF @Version <> @PreVersion
            RAISERROR('Version mismatch...', 16, 10);

        DECLARE @DcNoteNumber INT;

        SELECT @DcNoteNumber = Number
        FROM ACC.DCNote
        WHERE VoucherItemID = @VoucherItemID;

        IF @DcNoteNumber IS NOT NULL
        BEGIN
            SET @Message
                = N' ردیف ' + CAST(@VoucherItemIndex AS VARCHAR(10)) + N' به دلیل استفاده در اعلامیه '
                  + CAST(@DcNoteNumber AS VARCHAR(10)) + N' قابل ویرایش نمی باشد ';
            RAISERROR(@Message, 16, 12);
            RETURN;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM ACC.VoucherAnalyze AS va
            WHERE va.CreditVoucherItemID = @VoucherItemID
                  OR va.DebitVoucherItemID = @VoucherItemID
        )
        BEGIN
            SET @Message
                = N' ردیف ' + CAST(@VoucherItemIndex AS VARCHAR(10))
                  + N' به دلیل استفاده در آنالیز قابل ویرایش نمی باشد ';
            RAISERROR(@Message, 16, 12);
            RETURN;
        END;

        SET @Version = @Version + 1

        UPDATE [ACC].[VoucherItem]
        SET [VoucherItemIndex] = @VoucherItemIndex,
            [SlID] = @SlID,
            [Description] = @Description,
            [Description2] = @Description2,
            [Debit] = @Debit,
            [Credit] = @Credit,
            [CurrencyID] = @CurrencyID,
            [CurrencyRate] = @CurrencyRate,
            [CurrencyDebit] = @CurrencyDebit,
            [CurrencyCredit] = @CurrencyCredit,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version
        WHERE [VoucherItemID] = @VoucherItemID;

    END;

    -- Begin Return Select <- do not remove
    SELECT @Version
    -- End Return Select <- do not remove
