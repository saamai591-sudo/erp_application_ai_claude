/************************************************************
 * Code formatted by SoftTree SQL Assistant © v11.3.277
 * Time: 6/2/2021 12:17:02 PM
 ************************************************************/

CREATE  
 PROCEDURE [ACC].[spSetMultiPrevoucherItemDL]
(@DlID BIGINT, @SelectedPrevoucherItems NVARCHAR(MAX))
AS
	SET NOCOUNT ON 
	DECLARE @DlTypeID     INT,
	        @UserID       INT
	
	SELECT @DlTypeID = d.DlTypeID
	FROM   acc.DL AS d
	WHERE  d.DLID = @DlID
	
	SET @UserID = cfg.GetuserID()
	
	SELECT rfcst.[value] AS PrevoucherItemID
	INTO   #SelectedPrevoucherItem
	FROM   cfg.R_FnCommaStr2Table(@SelectedPrevoucherItems) AS rfcst
	
	INSERT INTO acc.PreVoucherItemAccountLevel
	  (
	    -- PreVoucherItemAccountLevelID -- this column value is auto-generated
	    PreVoucherItemID,
	    AccountLevelID,
	    DlID,
	    [Value],
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT spvi.PreVoucherItemID,
	       als.AccountLevelID,
	       @DlID,
	       NULL,
	       @UserID,
	       GETDATE(),
	       @UserID,
	       GETDATE(),
	       0
	FROM   #SelectedPrevoucherItem spvi
	       JOIN acc.AccountLevelSL AS als
	            ON  als.SlID = spvi.SlID
	       LEFT JOIN acc.PreVoucherItemAccountLevel AS pvial
	            ON  pvial.PreVoucherItemID = spvi.PreVoucherItemID
	WHERE  als.DlTypeID = @DlTypeID
	       AND pvial.PreVoucherItemAccountLevelID IS NULL