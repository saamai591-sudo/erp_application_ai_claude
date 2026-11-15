CREATE     PROC [CTM].[spSubscribeCardUpdate]
    @SubscribeCardID INT,
    @PartyID BIGINT,
    @Number NVARCHAR(50),
    @Password VARCHAR(512),
    @IssueDate DATE,
    @ExpireDate DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC CTM.CheckSubscribeCard @Id = @SubscribeCardID,
                                @Number = @Number,
                                @Issuedate = @IssueDate,
                                @ExpireDate = @ExpireDate,
                                @PartyId = @PartyID;

    IF @Version =
    (
        SELECT [Version]
        FROM [CTM].[SubscribeCard]
        WHERE [SubscribeCardID] = @SubscribeCardID
    )
    BEGIN

        SET @Version = @Version + 1;

        UPDATE [CTM].[SubscribeCard]
        SET [PartyID] = @PartyID,
            [Number] = @Number,
            [Password] = @Password,
            [IssueDate] = @IssueDate,
            [ExpireDate] = @ExpireDate,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version
        WHERE [SubscribeCardID] = @SubscribeCardID;

        -- Begin Return Select <- do not remove
        SELECT  [Version]
        FROM [CTM].[SubscribeCard]
        WHERE [SubscribeCardID] = @SubscribeCardID;
    -- End Return Select <- do not remove
    END;
END
