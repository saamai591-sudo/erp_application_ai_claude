/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 10/14/2018 11:55:16 AM
 ************************************************************/

CREATE PROCEDURE [CFG].[InsertOrUpdateFormViewSetting](
    @FormKey      VARCHAR(50),
    @FormType     TINYINT,
    @Setting      NVARCHAR(MAX)
)
AS
	IF EXISTS (
	       SELECT 1
	       FROM   cfg.FormViewSetting AS fvs
	       WHERE  fvs.FormKey = @FormKey
	              AND fvs.FormType = @FormType
	   )
	    UPDATE cfg.FormViewSetting
	    SET    Setting          = @Setting
	    WHERE  FormKey          = @FormKey
	           AND FormType     = @FormType
	ELSE
	    INSERT INTO cfg.FormViewSetting
	      (
	        -- FormViewSettingID -- this column value is auto-generated
	        FormKey,
	        FormType,
	        Setting
	      )
	    VALUES
	      (
	        @Formkey,
	        @Formtype,
	        @Setting
	      )
			