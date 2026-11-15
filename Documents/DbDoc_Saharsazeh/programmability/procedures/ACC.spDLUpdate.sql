
-----------------------------------------------------------------------
CREATE    PROC [ACC].[spDLUpdate] 
    @DLID bigint,
    @DlTypeID int,
    @Code varchar(100),
    @ParentID bigint,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @IsActive bit,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	IF @Version <> (SELECT [Version] FROM [ACC].[DL]
	WHERE [DLID] = @DLID)
	BEGIN
		RAISERROR('Version mismatch...', 16 , 10)
		RETURN;
	END

	DECLARE @Message NVARCHAR(MAX)

	-- Check Dl Code  Length
	DECLARE @dlLenth INT , @receivedCodeLenth INT

	SELECT  @dlLenth =dt.CodeLength
    FROM acc.DlType AS dt
    WHERE dt.DlTypeID=@DlTypeID

	IF @dlLenth IS NULL
	BEGIN 
		RAISERROR('DlCodeLengthNotSetInConfiguration',16,12)
		RETURN;
	END 

	SET @receivedCodeLenth= LEN(@Code)
	IF @receivedCodeLenth > @dlLenth
	BEGIN
		RAISERROR('DlCodeLengthNotInRange',16,12)
		RETURN;
    END
	
	DECLARE @IsManual BIT,
			@FirstNumber BIGINT,
			@LastNumber BIGINT

	SELECT  @IsManual = IsManual,
			@FirstNumber = FirstNumber,
			@LastNumber = LastNumber 
	FROM  [ACC].[DlType] WHERE DlTypeID = @DlTypeID

	IF @LastNumber IS NULL
		SET @LastNumber= REPLACE( REPLACE(STR('',@dlLenth),' ',9),'0','9')

	IF  @Code IS NULL
        OR @Code = '0' 
        OR @Code = '' 
    BEGIN			
		SET @Code=IsNull((SELECT  Max(CAST(Code AS BIGINT))+1 FROM Acc.DL d 
		WHERE CAST(code AS BIGINT) BETWEEN @FirstNumber AND	ISNULL( @LastNumber, 999999999999)),REPLACE( REPLACE(STR('',@dlLenth),' ',9),'0','1'))
    END	
    
	IF @Code>@LastNumber OR @Code<@FirstNumber
	BEGIN
        RAISERROR('ACC_spDLInsert_3',16,12)
        RETURN;
	END

    IF LEN(@Code) > @dlLenth
    BEGIN
        RAISERROR('طول کد این تفصیل بزرگتر از طول تعیین شده است. ',16,12)
        RETURN;
    END

	IF EXISTS  ( SELECT 1
                FROM   ACC.DL
                WHERE  Code  = @Code
                AND DLID<>@DLID
            ) 
    BEGIN
        RAISERROR( 'ACC_spDLInsert_2',16,12)
        RETURN;
		--کد تفصيل تکراري مي باشد.		
    END

    SET @Code = REPLACE(STR(@Code,@dlLenth),' ',0)	
	IF EXISTS(SELECT 1
		FROM  ACC.DL
		WHERE Title = @Title
		AND DLID<>@DLID
	)
	BEGIN
        RAISERROR( 'DlTitle_Duplicated',16,12)
        RETURN;
	END
	
	IF @DlTypeID=28 --SATURNNEW-2957
	BEGIN
		IF (SELECT LOWER(ConfigValue) from [CFG].[Configuration] where ConfigKey = 'SameCustomerCodeAndDlCode') = 'true'
		BEGIN
			UPDATE cfg.Party
			SET CustomerCode = @Code 
			FROM cfg.Party p
			JOIN acc.DL d ON d.DLID = p.DlID
			WHERE d.DLID=@DLID
			AND p.IsCustomer=1
		END
	end

	UPDATE [ACC].[DL]
	SET     [DlTypeID] = @DlTypeID, 
			[Code] = @Code, 
			[ParentID] = @ParentID, 
			[Title] = @Title, 
			[Title2] = @Title2, 
			[IsActive] = @IsActive, 
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [DLID] = @DLID
		
	-- Begin Return Select <- do not remove
	SELECT [Version],
			[Code] 
	FROM   [ACC].[DL]
	WHERE  [DLID] = @DLID	
	-- End Return Select <- do not remove
